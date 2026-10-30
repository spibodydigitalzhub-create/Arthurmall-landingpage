require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env")
});

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Administrator authentication required."
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "arthurs-mall-api",
      audience: "arthurs-mall-admin"
    });

    if (
      payload.role !== "admin" ||
      payload.username !== process.env.ADMIN_USERNAME
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access denied."
      });
    }

    req.admin = {
      username: payload.username,
      role: payload.role
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired administrator session."
    });
  }
}

function parseSpecifications(value) {
  try {
    return typeof value === "string"
      ? JSON.parse(value || "{}")
      : value || {};
  } catch {
    return {};
  }
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sendError(res, error, message) {
  console.error(message, error.message);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message
    });
  }
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Arthur's Mall API",
    version: "1.0.0"
  });
});

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      success: true,
      status: "online",
      service: "Arthur's Mall API",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({
      success: false,
      status: "unavailable",
      database: "disconnected"
    });
  }
});

// Administrator authentication

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 100 ||
      password.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid username and password."
      });
    }

    if (
      !process.env.ADMIN_USERNAME ||
      !process.env.ADMIN_PASSWORD_HASH ||
      !process.env.JWT_SECRET
    ) {
      return res.status(500).json({
        success: false,
        message: "Administrator authentication is not configured."
      });
    }

    const matches =
      username === process.env.ADMIN_USERNAME &&
      bcrypt.compareSync(password, process.env.ADMIN_PASSWORD_HASH);

    if (!matches) {
      return res.status(401).json({
        success: false,
        message: "Incorrect username or password."
      });
    }

    const token = jwt.sign(
      {
        username: process.env.ADMIN_USERNAME,
        role: "admin"
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "2h",
        issuer: "arthurs-mall-api",
        audience: "arthurs-mall-admin"
      }
    );

    res.json({
      success: true,
      message: "Administrator login successful.",
      token,
      expiresIn: 7200,
      admin: {
        username: process.env.ADMIN_USERNAME
      }
    });
  } catch (error) {
    sendError(res, error, "Unable to sign in.");
  }
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// Public product catalogue

app.get("/api/products", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, brand, model, description, specifications,
             price, category, image_url, images, stock, active, created_at
      FROM products
      WHERE active = 1
      ORDER BY id DESC
    `);

    const products = result.rows.map(product => ({
      ...product,
      specifications: parseSpecifications(product.specifications)
    }));

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    sendError(res, error, "Unable to retrieve products.");
  }
});

// Protected product management

app.get("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, brand, model, description, specifications,
             price, category, image_url, images, stock, active, created_at
      FROM products
      ORDER BY id DESC
    `);

    const products = result.rows.map(product => ({
      ...product,
      specifications: parseSpecifications(product.specifications)
    }));

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    sendError(res, error, "Unable to retrieve products.");
  }
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const { name, brand, model, price, stock } = b;

    if (
      typeof name !== "string" || !name.trim() || name.trim().length > 150 ||
      typeof brand !== "string" || !brand.trim() || brand.trim().length > 80 ||
      typeof model !== "string" || !model.trim() || model.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid name, brand and model are required."
      });
    }

    if (
      !Number.isSafeInteger(price) || price < 0 ||
      !Number.isSafeInteger(stock) || stock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Price and stock must be non-negative whole numbers."
      });
    }

    const description = b.description === undefined ? "" : b.description;
    const category = b.category === undefined ? "Smartphones" : b.category;
    const imageUrl = b.image_url === undefined ? "" : b.image_url;
    const images = b.images === undefined
      ? (imageUrl ? [imageUrl] : [])
      : b.images;

    if (
      !Array.isArray(images) || images.length > 4 ||
      images.some(url => typeof url !== "string" ||
        url.length > 2000 || !/^https:\/\/.+/i.test(url))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide up to four valid HTTPS image URLs."
      });
    }

    const gallery = images;
    const mainImage = gallery[0] || imageUrl;
    const specs = b.specifications === undefined ? {} : b.specifications;

    if (
      typeof description !== "string" || description.length > 5000 ||
      typeof category !== "string" || category.length > 80 ||
      typeof mainImage !== "string" || mainImage.length > 2000 ||
      !specs || typeof specs !== "object" || Array.isArray(specs) ||
      Buffer.byteLength(JSON.stringify(specs), "utf8") > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid description, category, image or specifications."
      });
    }

    const result = await db.query(`
      INSERT INTO products
        (name, brand, model, description, specifications, price,
         category, image_url, images, stock, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
      RETURNING id
    `, [
      name.trim(),
      brand.trim(),
      model.trim(),
      description,
      JSON.stringify(specs),
      price,
      category.trim() || "Smartphones",
      mainImage.trim(),
      JSON.stringify(gallery),
      stock
    ]);

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      productId: result.rows[0].id
    });
  } catch (error) {
    sendError(res, error, "Unable to add product.");
  }
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const found = await db.query(
      "SELECT * FROM products WHERE id = $1",
      [id]
    );

    if (!found.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const current = found.rows[0];
    const b = req.body || {};

    const name = b.name === undefined ? current.name : b.name;
    const brand = b.brand === undefined ? current.brand : b.brand;
    const model = b.model === undefined ? current.model : b.model;
    const description = b.description === undefined ? current.description : b.description;
    const category = b.category === undefined ? current.category : b.category;
    const imageUrl = b.image_url === undefined ? current.image_url : b.image_url;
    const currentImages = Array.isArray(current.images)
      ? current.images
      : (current.image_url ? [current.image_url] : []);

    const images = b.images === undefined ? currentImages : b.images;

    if (
      !Array.isArray(images) || images.length > 4 ||
      images.some(url => typeof url !== "string" ||
        url.length > 2000 || !/^https:\/\/.+/i.test(url))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide up to four valid HTTPS image URLs."
      });
    }

    const gallery = images;
    const mainImage = gallery[0] || imageUrl;
    const price = b.price === undefined ? current.price : b.price;
    const stock = b.stock === undefined ? current.stock : b.stock;
    const specs = b.specifications === undefined
      ? parseSpecifications(current.specifications)
      : b.specifications;

    if (
      typeof name !== "string" || !name.trim() || name.length > 150 ||
      typeof brand !== "string" || !brand.trim() || brand.length > 80 ||
      typeof model !== "string" || !model.trim() || model.length > 100 ||
      typeof description !== "string" || description.length > 5000 ||
      typeof category !== "string" || category.length > 80 ||
      typeof mainImage !== "string" || mainImage.length > 2000 ||
      !Number.isSafeInteger(price) || price < 0 ||
      !Number.isSafeInteger(stock) || stock < 0 ||
      !specs || typeof specs !== "object" || Array.isArray(specs) ||
      Buffer.byteLength(JSON.stringify(specs), "utf8") > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more product fields are invalid."
      });
    }

    await db.query(`
      UPDATE products
      SET name = $1, brand = $2, model = $3, description = $4,
          specifications = $5, price = $6, category = $7,
          image_url = $8, images = $9::jsonb, stock = $10
      WHERE id = $11
    `, [
      name.trim(),
      brand.trim(),
      model.trim(),
      description,
      JSON.stringify(specs),
      price,
      category.trim() || "Smartphones",
      mainImage.trim(),
      JSON.stringify(gallery),
      stock,
      id
    ]);

    res.json({
      success: true,
      message: "Product updated successfully."
    });
  } catch (error) {
    sendError(res, error, "Unable to update product.");
  }
});

app.patch("/api/admin/products/:id/stock", requireAdmin, async (req, res) => {
  try {
    const id = validId(req.params.id);
    const { stock } = req.body || {};

    if (!id || !Number.isSafeInteger(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid product ID and stock quantity."
      });
    }

    const result = await db.query(
      "UPDATE products SET stock = $1 WHERE id = $2",
      [stock, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    res.json({
      success: true,
      message: "Inventory updated successfully."
    });
  } catch (error) {
    sendError(res, error, "Unable to update inventory.");
  }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const result = await db.query(`
      UPDATE products SET active = 0
      WHERE id = $1 AND active = 1
    `, [id]);

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: "Active product not found."
      });
    }

    res.json({
      success: true,
      message: "Product deactivated. Existing order records are preserved."
    });
  } catch (error) {
    sendError(res, error, "Unable to deactivate product.");
  }
});

// Protected order management

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.id, o.customer_name, o.customer_phone,
             o.delivery_address, o.product_id, o.quantity,
             o.unit_price, o.total_price, o.payment_method,
             o.status, o.created_at,
             p.name AS product_name,
             p.brand AS product_brand,
             p.model AS product_model
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      ORDER BY o.id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      orders: result.rows
    });
  } catch (error) {
    sendError(res, error, "Unable to retrieve orders.");
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  const id = validId(req.params.id);
  const { status } = req.body || {};

  const allowedStatuses = [
    "Pending", "Confirmed", "Processing",
    "Shipped", "Delivered", "Cancelled"
  ];

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID."
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order status."
    });
  }

  let client;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    const found = await client.query(`
      SELECT id, product_id, quantity, status
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `, [id]);

    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Order not found."
      });
    }

    const order = found.rows[0];

    if (order.status === "Cancelled") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Cancelled orders cannot be changed."
      });
    }

    if (order.status === "Delivered" && status !== "Delivered") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Delivered orders cannot be changed."
      });
    }

    if (order.status === "Shipped" && status === "Cancelled") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "A shipped order cannot be cancelled here. Resolve its delivery first."
      });
    }

    if (status === "Cancelled") {
      await client.query(`
        UPDATE products
        SET stock = stock + $1
        WHERE id = $2
      `, [order.quantity, order.product_id]);
    }

    await client.query(`
      UPDATE orders SET status = $1 WHERE id = $2
    `, [status, id]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Order status updated successfully.",
      order: { id, status }
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    sendError(res, error, "Unable to update order status.");
  } finally {
    if (client) client.release();
  }
});

// Dashboard statistics

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [productsResult, ordersResult] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE active = 1)::int AS active_products,
          COALESCE(SUM(stock) FILTER (WHERE active = 1), 0)::int AS units_in_stock,
          COUNT(*) FILTER (WHERE active = 1 AND stock <= 5)::int AS low_stock
        FROM products
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE status = 'Delivered')::int AS delivered_orders,
          COUNT(*) FILTER (WHERE status = 'Cancelled')::int AS cancelled_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'Delivered'), 0)::int AS delivered_sales
        FROM orders
      `)
    ]);

    res.json({
      success: true,
      stats: {
        ...productsResult.rows[0],
        ...ordersResult.rows[0],
        currency: "GHS"
      }
    });
  } catch (error) {
    sendError(res, error, "Unable to retrieve dashboard statistics.");
  }
});

// Customer order creation

app.post("/api/orders", async (req, res) => {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    productId,
    quantity
  } = req.body || {};

  if (
    typeof customerName !== "string" ||
    customerName.trim().length < 2 ||
    customerName.trim().length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid customer name."
    });
  }

  if (
    typeof customerPhone !== "string" ||
    !/^[+0-9()\-\s]{7,20}$/.test(customerPhone.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid phone number."
    });
  }

  if (
    typeof deliveryAddress !== "string" ||
    deliveryAddress.trim().length < 5 ||
    deliveryAddress.trim().length > 300
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid delivery address."
    });
  }

  if (
    !Number.isSafeInteger(productId) ||
    productId < 1 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 10
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid product or quantity. Quantity must be 1–10."
    });
  }

  let client;

  try {
    client = await db.connect();
    await client.query("BEGIN");

    const productResult = await client.query(`
      SELECT id, name, price, stock
      FROM products
      WHERE id = $1 AND active = 1
      FOR UPDATE
    `, [productId]);

    if (!productResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const product = productResult.rows[0];

    if (product.stock < quantity) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Insufficient stock available."
      });
    }

    const totalPrice = product.price * quantity;

    if (!Number.isSafeInteger(totalPrice)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Order total is invalid."
      });
    }

    const orderResult = await client.query(`
      INSERT INTO orders (
        customer_name, customer_phone, delivery_address,
        product_id, quantity, unit_price, total_price,
        payment_method, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      customerName.trim(),
      customerPhone.trim(),
      deliveryAddress.trim(),
      product.id,
      quantity,
      product.price,
      totalPrice,
      "Pay on delivery",
      "Pending"
    ]);

    await client.query(`
      UPDATE products
      SET stock = stock - $1
      WHERE id = $2
    `, [quantity, product.id]);

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order received successfully.",
      order: {
        id: orderResult.rows[0].id,
        product: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice,
        currency: "GHS",
        status: "Pending",
        paymentMethod: "Pay on delivery"
      }
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    sendError(res, error, "Unable to create order. Please try again.");
  } finally {
    if (client) client.release();
  }
});

// Start server

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Arthur's Mall API running on port ${PORT}`);
});

module.exports = app;
