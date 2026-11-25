CREATE DATABASE IF NOT EXISTS shopease;
USE shopease;

CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(80) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  product_name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('Placed','Packed','Shipped','Delivered','Cancelled') DEFAULT 'Placed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);
CREATE TABLE IF NOT EXISTS stock_audit (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  old_stock INT NOT NULL,
  new_stock INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created ON orders(created_at);

CREATE OR REPLACE VIEW customer_order_summary AS
SELECT u.user_id, u.name, u.email, COUNT(o.order_id) AS total_orders,
       COALESCE(SUM(o.total_amount),0) AS total_spent
FROM users u LEFT JOIN orders o ON u.user_id=o.user_id
GROUP BY u.user_id,u.name,u.email;

DROP TRIGGER IF EXISTS trg_stock_audit;
DELIMITER //
CREATE TRIGGER trg_stock_audit AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF OLD.stock <> NEW.stock THEN
    INSERT INTO stock_audit(product_id,old_stock,new_stock)
    VALUES(OLD.product_id,OLD.stock,NEW.stock);
  END IF;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS sp_sales_summary;
DELIMITER //
CREATE PROCEDURE sp_sales_summary()
BEGIN
  SELECT DATE(created_at) AS sale_date, COUNT(*) AS orders_count,
         SUM(total_amount) AS revenue
  FROM orders WHERE status <> 'Cancelled'
  GROUP BY DATE(created_at) ORDER BY sale_date DESC;
END//
DELIMITER ;

INSERT IGNORE INTO categories(category_name) VALUES
('Electronics'),('Fashion'),('Books'),('Home');

INSERT INTO products(category_id,product_name,description,price,stock,image_url)
SELECT category_id,'Wireless Headphones','Comfortable wireless headphones',1499,18,
'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=700'
FROM categories WHERE category_name='Electronics'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name='Wireless Headphones');

INSERT INTO products(category_id,product_name,description,price,stock,image_url)
SELECT category_id,'Everyday Sneakers','Casual sneakers for daily use',2199,14,
'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=700'
FROM categories WHERE category_name='Fashion'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name='Everyday Sneakers');

INSERT INTO products(category_id,product_name,description,price,stock,image_url)
SELECT category_id,'SQL Made Simple','Beginner friendly database guide',599,25,
'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=700'
FROM categories WHERE category_name='Books'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name='SQL Made Simple');

INSERT INTO products(category_id,product_name,description,price,stock,image_url)
SELECT category_id,'Minimal Desk Lamp','LED desk lamp for study table',899,20,
'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=700'
FROM categories WHERE category_name='Home'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name='Minimal Desk Lamp');
