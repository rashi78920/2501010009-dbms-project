
const API = '/api';

let token = localStorage.getItem('se_token') || '';
let user = JSON.parse(localStorage.getItem('se_user') || 'null');
let cart = JSON.parse(localStorage.getItem('se_cart') || '[]');

const app = document.getElementById('app');

const money = n => '₹' + Number(n).toLocaleString('en-IN');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: 'Bearer ' + token } : {})
});

async function api(path, opt = {}) {
  let r = await fetch(API + path, {
    ...opt,
    headers: { ...headers(), ...(opt.headers || {}) }
  });

  let d = await r.json();

  if (!r.ok) throw Error(d.message || 'Request failed');

  return d;
}

function save() {
  localStorage.setItem('se_cart', JSON.stringify(cart));

  const cartCount = document.getElementById('cartCount');

  if (cartCount) {
    cartCount.textContent =
      cart.reduce((s, x) => s + x.qty, 0);
  }
}

function nav() {
  document.getElementById('accountLink').textContent =
    user ? user.name : 'Login';

  document.getElementById('adminLink').classList.toggle(
    'hidden',
    user?.role !== 'admin'
  );

  save();
}

function card(p) {
  return `
    <article class="product">
      <img src="${p.image_url}"
        onerror="this.src='https://placehold.co/500x300?text=ShopEase'">

      <div class="product-body">
        <small class="muted">${p.category_name || ''}</small>

        <h3>${p.product_name}</h3>

        <p>${p.description || ''}</p>

        <div class="head">
          <b class="price">${money(p.price)}</b>

          <button class="btn"
            onclick="add(${p.product_id})"
            ${p.stock < 1 ? 'disabled' : ''}>
            Add to cart
          </button>
        </div>

        <small class="muted">${p.stock} in stock</small>
      </div>
    </article>
  `;
}


// MAIN RENDER

async function render() {
  nav();

  let page = location.hash.slice(1) || 'home';

  try {
    if (page === 'home') {
      app.innerHTML = `
        <section class="hero">
          <div>
            <small>WELCOME TO SHOPEASE</small>
            <h1>Find your next favourite thing.</h1>
            <p>Everyday essentials, thoughtful picks and a simple shopping experience.</p>
            <a class="btn light" href="#shop">Explore products</a>
          </div>
          <div class="art">🛍️</div>
        </section>

        <section class="container">
          <div class="head">
            <h2>Popular picks</h2>
            <a href="#shop">View all →</a>
          </div>
          <div id="featured" class="grid"></div>
        </section>
      `;

      let p = await api('/products');

      document.getElementById('featured').innerHTML =
        p.slice(0, 4).map(card).join('');
    }

    if (page === 'shop') {
      app.innerHTML = `
        <section class="container">
          <h2>Explore products</h2>

          <div class="toolbar">
            <input id="q" placeholder="Search products">

            <select id="cat">
              <option value="">All categories</option>
            </select>

            <button class="btn" onclick="loadProducts()">Search</button>
          </div>

          <div id="products" class="grid"></div>
        </section>
      `;

      let c = await api('/categories');

      document.getElementById('cat').innerHTML +=
        c.map(x => `
          <option value="${x.category_id}">
            ${x.category_name}
          </option>
        `).join('');

      await loadProducts();
    }

    if (page === 'cart') cartPage();

    if (page === 'account') accountPage();

    if (page === 'orders') await ordersPage();

    if (page === 'admin') await adminPage();

  } catch (e) {
    app.innerHTML = `
      <section class="container empty">
        <h2>Could not load page</h2>
        <p>${e.message}</p>
        <button class="btn" onclick="render()">Retry</button>
      </section>
    `;
  }
}


// LOAD PRODUCTS

async function loadProducts() {
  let q = encodeURIComponent(document.getElementById('q').value);
  let c = encodeURIComponent(document.getElementById('cat').value);

  let p = await api(`/products?search=${q}&category=${c}`);

  document.getElementById('products').innerHTML =
    p.length ? p.map(card).join('') :
    '<div class="empty">No products found.</div>';
}


// ADD TO CART

async function add(id) {
  let p = (await api('/products')).find(x => x.product_id === id);

  let x = cart.find(x => x.id === id);

  if (x) x.qty++;
  else cart.push({
    id,
    qty: 1,
    name: p.product_name,
    price: p.price
  });

  save();

  alert('Added to cart');
}


// CART PAGE

function cartPage() {
  if (!cart.length) {
    app.innerHTML = `
      <section class="container empty">
        <h2>Your cart is empty</h2>
        <a class="btn" href="#shop">Explore products</a>
      </section>
    `;
    return;
  }

  let total = cart.reduce((s, x) => s + x.qty * x.price, 0);

  app.innerHTML = `
    <section class="container">
      <h2>Your cart</h2>

      <div class="panel">
        ${cart.map((x, i) => `
          <div class="row">
            <div>
              <b>${x.name}</b>
              <div class="muted">${money(x.price)} each</div>
            </div>

            <div>
              <button class="btn light" onclick="qty(${i},-1)">−</button>
              ${x.qty}
              <button class="btn light" onclick="qty(${i},1)">+</button>
              <button class="btn" onclick="removeItem(${i})">Remove</button>
            </div>
          </div>
        `).join('')}

        <div class="head">
          <h3>Total: ${money(total)}</h3>
          <button class="btn" onclick="checkout()">Place COD order</button>
        </div>
      </div>
    </section>
  `;
}


function qty(i, n) {
  cart[i].qty += n;

  if (cart[i].qty < 1) cart.splice(i, 1);

  save();
  cartPage();
}


function removeItem(i) {
  cart.splice(i, 1);

  save();
  cartPage();
}


// CHECKOUT

async function checkout() {
  if (!user) {
    alert('Please login first');
    location.hash = 'account';
    return;
  }

  try {
    let d = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: cart.map(x => ({
          productId: x.id,
          quantity: x.qty
        }))
      })
    });

    cart = [];

    save();

    alert('Order #' + d.orderId + ' placed successfully');

    location.hash = 'orders';

  } catch (e) {
    alert(e.message);
  }
}


// ACCOUNT PAGE

function accountPage() {
  if (user) {
    app.innerHTML = `
      <section class="container form">
        <div class="panel">
          <h2>Hello, ${user.name}</h2>
          <p>${user.email}</p>
          <button class="btn" onclick="logout()">Logout</button>
        </div>
      </section>
    `;
    return;
  }

  app.innerHTML = `
    <section class="container form">
      <div class="panel">
        <h2>Welcome to ShopEase</h2>

        <div class="toolbar">
          <button class="btn" onclick="authForm('login')">Login</button>
          <button class="btn light" onclick="authForm('register')">Register</button>
        </div>

        <div id="auth"></div>
      </div>
    </section>
  `;

  authForm('login');
}


// LOGIN / REGISTER FORMS

function authForm(t) {
  document.getElementById('auth').innerHTML =
    t === 'login' ? `
      <form onsubmit="login(event)">
        <label class="field">Email
          <input name="email" type="email" required>
        </label>

        <label class="field">Password
          <input name="password" type="password" required>
        </label>

        <button class="btn">Login</button>
      </form>
    ` : `
      <form onsubmit="register(event)">
        <label class="field">Name
          <input name="name" required>
        </label>

        <label class="field">Email
          <input name="email" type="email" required>
        </label>

        <label class="field">Password
          <input name="password" type="password" minlength="6" required>
        </label>

        <button class="btn">Create account</button>
      </form>
    `;
}


// LOGIN

async function login(e) {
  e.preventDefault();

  try {
    let d = await api('/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
    });

    token = d.token;
    user = d.user;

    localStorage.setItem('se_token', token);
    localStorage.setItem('se_user', JSON.stringify(user));

    location.hash = 'home';

  } catch (x) {
    alert(x.message);
  }
}


// REGISTER

async function register(e) {
  e.preventDefault();

  try {
    await api('/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(e.target)))
    });

    alert('Account created. Please login.');

    authForm('login');

  } catch (x) {
    alert(x.message);
  }
}


// LOGOUT

function logout() {
  token = '';
  user = null;

  localStorage.removeItem('se_token');
  localStorage.removeItem('se_user');

  location.hash = 'home';
}


// CUSTOMER ORDERS

async function ordersPage() {
  if (!user) {
    app.innerHTML = `
      <section class="container empty">
        <h2>Login to see your orders</h2>
        <a class="btn" href="#account">Login</a>
      </section>
    `;
    return;
  }

  let r = await api('/orders');

  app.innerHTML = `
    <section class="container">
      <h2>My Orders</h2>

      ${r.length ? `
        <div class="tablewrap">
          <table class="table">
            <tr>
              <th>Order</th>
              <th>Items</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>

            ${r.map(o => `
              <tr>
                <td>#${o.order_id}</td>
                <td>${o.items}</td>
                <td>${new Date(o.created_at).toLocaleDateString()}</td>
                <td>${money(o.total_amount)}</td>
                <td>${o.status}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : '<div class="empty">No orders yet.</div>'}
    </section>
  `;
}


// ADMIN DASHBOARD

async function adminPage() {
  if (user?.role !== 'admin') {
    app.innerHTML = `
      <section class="container empty">
        <h2>Admin access required</h2>
      </section>
    `;
    return;
  }

  let s = await api('/admin/stats');

  app.innerHTML = `
    <section class="container">
      <h2>Admin dashboard</h2>

      <div class="stats">
        <div class="stat">
          Total orders
          <strong>${s.totalOrders}</strong>
        </div>

        <div class="stat">
          Revenue
          <strong>${money(s.revenue)}</strong>
        </div>

        <div class="stat">
          Customers
          <strong>${s.totalCustomers}</strong>
        </div>
      </div>

      <div class="panel">
        <div class="head">
          <h3>Manage Products</h3>

          <button class="btn" onclick="productForm()">
            ＋ Add Product
          </button>
        </div>

        <div id="productFormArea"></div>

        <div id="adminProducts">Loading products...</div>
      </div>


      <!-- MANAGE ORDERS -->

      <div class="panel" style="margin-top:20px">
        <h3>Manage Orders</h3>

        <div id="adminOrders">Loading orders...</div>
      </div>


      <!-- DATABASE REPORTS -->

      <div class="panel" style="margin-top:20px">
        <h3>Database reports</h3>

        <div class="toolbar">
          <button class="btn" onclick="report('customer-summary')">View summary</button>

          <button class="btn" onclick="report('customers-with-orders')">Correlated subquery</button>

          <button class="btn" onclick="report('above-average-products')">Non-correlated subquery</button>

          <button class="btn" onclick="report('sales-report')">Stored procedure</button>
        </div>

        <pre id="report"></pre>
      </div>
    </section>
  `;

  await adminProducts();

  await adminOrders();
}


// SHOW ALL PRODUCTS IN ADMIN

async function adminProducts() {
  const products = await api('/products');

  document.getElementById('adminProducts').innerHTML =
    products.length ? `
      <div class="tablewrap" style="margin-top:16px">
        <table class="table">
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>

          ${products.map(p => `
            <tr>
              <td>${p.product_name}</td>
              <td>${p.category_name || '—'}</td>
              <td>${money(p.price)}</td>
              <td>${p.stock}</td>

              <td>
                <button class="btn light"
                  onclick="productForm(${p.product_id})">
                  Edit
                </button>

                <button class="btn danger"
                  onclick="deleteProduct(${p.product_id})">
                  Delete
                </button>
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '<p class="muted">No products added yet.</p>';
}


// SHOW ALL ORDERS IN ADMIN

async function adminOrders() {
  const orders = await api('/admin/orders');

  const area = document.getElementById('adminOrders');

  if (!area) return;

  if (!orders.length) {
    area.innerHTML = '<p class="muted">No orders found.</p>';
    return;
  }

  const statuses = [
    'Pending',
    'Processing',
    'Shipped',
    'Delivered',
    'Cancelled'
  ];

  area.innerHTML = `
    <div class="tablewrap" style="margin-top:16px">
      <table class="table">
        <tr>
          <th>Order ID</th>
          <th>Customer</th>
          <th>Email</th>
          <th>Items</th>
          <th>Date</th>
          <th>Total</th>
          <th>Status</th>
          <th>Update</th>
        </tr>

        ${orders.map(o => `
          <tr>
            <td>#${o.order_id}</td>

            <td>${o.customer_name}</td>

            <td>${o.customer_email}</td>

            <td>${o.items || '—'}</td>

            <td>${new Date(o.created_at).toLocaleDateString()}</td>

            <td>${money(o.total_amount)}</td>

            <td>
              <select id="status-${o.order_id}">
                ${statuses.map(s => `
                  <option value="${s}"
                    ${o.status === s ? 'selected' : ''}>
                    ${s}
                  </option>
                `).join('')}
              </select>
            </td>

            <td>
              <button class="btn"
                onclick="updateOrderStatus(${o.order_id})">
                Save
              </button>
            </td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
}


// UPDATE ORDER STATUS

async function updateOrderStatus(id) {
  const status = document.getElementById(`status-${id}`).value;

  try {
    await api(`/admin/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    alert('Order status updated successfully!');

    await adminOrders();

  } catch (e) {
    alert(e.message);
  }
}


// ADD / EDIT PRODUCT FORM

async function productForm(id = null) {
  const area = document.getElementById('productFormArea');

  const [cats, products] = await Promise.all([
    api('/categories'),
    api('/products')
  ]);

  const p = id ? products.find(x => x.product_id === id) : null;

  area.innerHTML = `
    <form class="product-form"
      onsubmit="saveProduct(event,${id || 'null'})">

      <label class="field">
        Product name
        <input name="product_name" required
          value="${p?.product_name || ''}">
      </label>

      <label class="field">
        Category
        <select name="category_id">
          <option value="">Select category</option>

          ${cats.map(c => `
            <option value="${c.category_id}"
              ${p?.category_id === c.category_id ? 'selected' : ''}>
              ${c.category_name}
            </option>
          `).join('')}
        </select>
      </label>

      <label class="field">
        Description
        <input name="description"
          value="${p?.description || ''}">
      </label>

      <div class="toolbar">
        <label class="field">
          Price (₹)
          <input name="price" type="number"
            min="0" step="0.01" required
            value="${p?.price ?? ''}">
        </label>

        <label class="field">
          Stock
          <input name="stock" type="number"
            min="0" step="1" required
            value="${p?.stock ?? ''}">
        </label>
      </div>

      <label class="field">
        Image URL
        <input name="image_url" type="url"
          value="${p?.image_url || ''}">
      </label>

      <button class="btn">
        ${p ? 'Update Product' : 'Save Product'}
      </button>

      <button type="button" class="btn light"
        onclick="document.getElementById('productFormArea').innerHTML=''">
        Cancel
      </button>
    </form>
  `;

  area.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}


// SAVE PRODUCT

async function saveProduct(e, id) {
  e.preventDefault();

  try {
    const data = Object.fromEntries(new FormData(e.target));

    data.category_id = data.category_id || null;
    data.price = Number(data.price);
    data.stock = Number(data.stock);

    await api(
      id ? `/admin/products/${id}` : '/admin/products',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      }
    );

    alert(id ? 'Product updated' : 'Product added');

    document.getElementById('productFormArea').innerHTML = '';

    await adminProducts();

  } catch (err) {
    alert(err.message);
  }
}


// DELETE PRODUCT

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) {
    return;
  }

  try {
    await api(`/admin/products/${id}`, {
      method: 'DELETE'
    });

    alert('Product deleted');

    await adminProducts();

  } catch (e) {
    alert(e.message);
  }
}


// DATABASE REPORTS

async function report(n) {
  try {
    document.getElementById('report').textContent =
      JSON.stringify(await api('/admin/' + n), null, 2);

  } catch (e) {
    alert(e.message);
  }
}


// PAGE CHANGE

window.addEventListener('hashchange', render);

render();
