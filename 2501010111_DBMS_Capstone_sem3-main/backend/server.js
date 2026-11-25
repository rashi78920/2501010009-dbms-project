
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./config/db');

const { authenticate, adminOnly } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

app.get('/api/health', (req, res) => {
  res.json({ message: 'ShopEase API running' });
});

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM categories ORDER BY category_name'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const { search = '', category = '' } = req.query;

    const [rows] = await db.query(`
      SELECT p.*, c.category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_name LIKE ?
      AND (? = '' OR p.category_id = ?)
      ORDER BY p.product_id DESC
    `, [`%${search}%`, category, category]);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ADD PRODUCT - ADMIN ONLY
app.post('/api/admin/products', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      category_id,
      product_name,
      description,
      price,
      stock,
      image_url
    } = req.body;

    if (!product_name || price === undefined || stock === undefined) {
      return res.status(400).json({
        message: 'Product name, price and stock are required'
      });
    }

    const [result] = await db.query(
      `INSERT INTO products
      (category_id, product_name, description, price, stock, image_url)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        category_id || null,
        product_name,
        description || '',
        Number(price),
        Number(stock),
        image_url || ''
      ]
    );

    res.status(201).json({
      message: 'Product added successfully',
      productId: result.insertId
    });

  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// EDIT PRODUCT - ADMIN ONLY
app.put('/api/admin/products/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      category_id,
      product_name,
      description,
      price,
      stock,
      image_url
    } = req.body;

    if (!product_name || price === undefined || stock === undefined) {
      return res.status(400).json({
        message: 'Product name, price and stock are required'
      });
    }

    const [result] = await db.query(
      `UPDATE products
      SET category_id = ?, product_name = ?, description = ?,
      price = ?, stock = ?, image_url = ?
      WHERE product_id = ?`,
      [
        category_id || null,
        product_name,
        description || '',
        Number(price),
        Number(stock),
        image_url || '',
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.json({ message: 'Product updated successfully' });

  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE PRODUCT - ADMIN ONLY
app.delete('/api/admin/products/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM products WHERE product_id = ?',
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.json({ message: 'Product deleted successfully' });

  } catch (e) {
    res.status(400).json({
      message: e.code === 'ER_ROW_IS_REFERENCED_2'
        ? 'This product is already part of an order and cannot be deleted. You can edit it or set stock to 0.'
        : e.message
    });
  }
});

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'All fields required'
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users(name, email, password_hash) VALUES(?,?,?)',
      [name, email, hash]
    );

    res.status(201).json({
      message: 'Account created',
      userId: result.insertId
    });

  } catch (e) {
    res.status(400).json({
      message: e.code === 'ER_DUP_ENTRY'
        ? 'Email already exists'
        : e.message
    });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [req.body.email]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(req.body.password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        message: 'Incorrect email or password'
      });
    }

    const u = rows[0];

    const token = jwt.sign(
      {
        userId: u.user_id,
        name: u.name,
        role: u.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: u.user_id,
        name: u.name,
        email: u.email,
        role: u.role
      }
    });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PLACE ORDER
app.post('/api/orders', authenticate, async (req, res) => {
  const conn = await db.getConnection();

  try {
    const items = req.body.items || [];

    if (!items.length) {
      return res.status(400).json({
        message: 'Cart is empty'
      });
    }

    await conn.beginTransaction();

    let total = 0;
    let verified = [];

    for (const item of items) {
      const [products] = await conn.query(
        'SELECT product_id, price, stock FROM products WHERE product_id = ? FOR UPDATE',
        [item.productId]
      );

      const qty = Number(item.quantity);

      if (!products.length || qty < 1 || products[0].stock < qty) {
        throw new Error('Product unavailable or insufficient stock');
      }

      total += Number(products[0].price) * qty;

      verified.push({
        id: products[0].product_id,
        qty,
        price: products[0].price
      });
    }

    const [order] = await conn.query(
      'INSERT INTO orders(user_id, total_amount) VALUES(?,?)',
      [req.user.userId, total]
    );

    for (const x of verified) {
      await conn.query(
        'INSERT INTO order_items(order_id, product_id, quantity, unit_price) VALUES(?,?,?,?)',
        [order.insertId, x.id, x.qty, x.price]
      );

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE product_id = ?',
        [x.qty, x.id]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Order placed',
      orderId: order.insertId,
      total
    });

  } catch (e) {
    await conn.rollback();
    res.status(400).json({ message: e.message });

  } finally {
    conn.release();
  }
});

// CUSTOMER ORDERS
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT o.*,
      GROUP_CONCAT(
        CONCAT(p.product_name, ' x ', oi.quantity)
        SEPARATOR ', '
      ) items
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.user_id = ?
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
    `, [req.user.userId]);

    res.json(rows);

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

 // ADMIN - GET ALL ORDERS
app.get('/api/admin/orders', authenticate, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        o.order_id,
        o.user_id,
        o.total_amount,
        o.status,
        o.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        GROUP_CONCAT(
          CONCAT(p.product_name, ' x ', oi.quantity)
          ORDER BY p.product_name
          SEPARATOR ', '
        ) AS items
      FROM orders o
      JOIN users u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.product_id
      GROUP BY
        o.order_id, o.user_id, o.total_amount,
        o.status, o.created_at, u.name, u.email
      ORDER BY o.created_at DESC
    `);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ADMIN - UPDATE ORDER STATUS
app.put('/api/admin/orders/:id/status', authenticate, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      'Pending',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status'
      });
    }

    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    res.json({
      message: 'Order status updated successfully'
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});


// ADMIN STATS
app.get('/api/admin/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [[a]] = await db.query(`
      SELECT COUNT(*) totalOrders,
      COALESCE(SUM(total_amount), 0) revenue
      FROM orders
      WHERE status <> 'Cancelled'
    `);

    const [[b]] = await db.query(`
      SELECT COUNT(*) totalCustomers
      FROM users
      WHERE role = 'customer'
    `);

    res.json({ ...a, ...b });

  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CUSTOMER SUMMARY
app.get('/api/admin/customer-summary', authenticate, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM customer_order_summary ORDER BY total_spent DESC'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// CUSTOMERS WITH ORDERS
app.get('/api/admin/customers-with-orders', authenticate, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.user_id, u.name, u.email
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM orders o
        WHERE o.user_id = u.user_id
      )
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ABOVE AVERAGE PRODUCTS
app.get('/api/admin/above-average-products', authenticate, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT product_name, price
      FROM products
      WHERE price > (SELECT AVG(price) FROM products)
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// SALES REPORT
app.get('/api/admin/sales-report', authenticate, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('CALL sp_sales_summary()');
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`ShopEase running at http://localhost:${PORT}`);
});
