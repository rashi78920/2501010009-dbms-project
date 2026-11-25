# ShopEase – E-Commerce Website (VS Code + MySQL Workbench)

## Requirements
- Node.js LTS
- MySQL Server and MySQL Workbench
- VS Code

## Run the project
1. Extract the ZIP and open the `ShopEase` folder in VS Code.
2. Open MySQL Workbench, connect to your local MySQL server.
3. Open `database/shopease.sql` in Workbench and execute the whole script (lightning icon).
4. In VS Code terminal, run `npm install`.
5. Copy `.env.example` to `.env`; enter your MySQL password in `DB_PASSWORD`.
6. Set a private random value for `JWT_SECRET`.
7. Run `npm run dev` (or `npm start`).
8. Open `http://localhost:5000` in your browser.

## Admin account
Register normally on the website. Then execute in Workbench, replacing the email:
```sql
USE shopease;
UPDATE users SET role='admin' WHERE email='your-email@example.com';
```
Log out and log in again to refresh the role in the login token.

## Demo flow
Home → Shop → add products → Cart → register/login → place COD demo order → My Orders.
Then promote a test user to admin and show the Admin dashboard reports.

## SQL concepts demonstrated
- DDL: CREATE DATABASE, CREATE TABLE, CREATE INDEX, CREATE VIEW.
- DML: INSERT, SELECT, UPDATE.
- Joins: products/categories and orders/order_items/products.
- Aggregate functions: COUNT, SUM, AVG, GROUP_CONCAT.
- Correlated subquery: EXISTS query in `customers-with-orders` report.
- Non-correlated subquery: product price greater than average price.
- View: `customer_order_summary`.
- Indexes: category, order user, order date.
- TCL/transaction: checkout uses BEGIN, COMMIT, ROLLBACK.
- Trigger: `trg_stock_audit` records stock changes.
- Stored procedure: `sp_sales_summary()`.

## Viva quick preparation
- Primary key: uniquely identifies a row.
- Foreign key: connects tables and enforces referential integrity.
- JOIN: combines related rows from tables.
- Aggregate function: calculates one result from multiple rows (e.g. SUM, AVG, COUNT).
- GROUP BY: groups rows for aggregate calculations.
- Correlated subquery: inner query refers to outer query columns.
- Non-correlated subquery: inner query runs independently of the outer query.
- View: a saved SELECT query exposed like a virtual table.
- Index: speeds up reads/lookups, but uses storage and can slow writes.
- Transaction: a set of operations treated as one unit.
- COMMIT: saves transaction changes; ROLLBACK: cancels uncommitted changes.
- Trigger: automatically executes when a table event occurs.
- Stored procedure: saved SQL routine called with CALL.

## Scope note
This is a college demonstration project. Checkout is a simulated Cash on Delivery flow; no real payment gateway is connected. DCL, cursor, window functions and CTEs are intentionally omitted to keep the project focused on the main required SQL concepts.
