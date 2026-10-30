const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const fs = require("node:fs");

const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(
  path.join(dataDir, "arthurs-mall.db")
);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    specifications TEXT NOT NULL DEFAULT '{}',
    price INTEGER NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL DEFAULT 'Smartphones',
    image_url TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
    total_price INTEGER NOT NULL CHECK (total_price >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Pay on delivery',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((item) => item.name === column);

  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing("products", "brand", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing("products", "model", "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing(
  "products",
  "specifications",
  "TEXT NOT NULL DEFAULT '{}'"
);

db.prepare(`
  UPDATE products
  SET brand = 'Xiaomi', model = 'Redmi 14C'
  WHERE name = 'Xiaomi Redmi 14C' AND brand = ''
`).run();

const productCount = db
  .prepare("SELECT COUNT(*) AS count FROM products")
  .get().count;

if (productCount === 0) {
  db.prepare(`
    INSERT INTO products (
      name,
      brand,
      model,
      description,
      specifications,
      price,
      category,
      stock
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "Xiaomi Redmi 14C",
    "Xiaomi",
    "Redmi 14C",
    "A stylish smartphone for everyday communication and entertainment.",
    JSON.stringify({
      display: "6.88-inch",
      camera: "50MP AI main camera",
      battery: "5160mAh",
      refreshRate: "Up to 120Hz"
    }),
    1550,
    "Smartphones",
    20
  );

  console.log("Default product added: Xiaomi Redmi 14C");
}

console.log("Arthur's Mall database initialized successfully.");

module.exports = db;
