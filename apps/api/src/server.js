const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "20kb" }));


// Administrator authentication
require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

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
      algorithms: ["HS256"]
    });

    if (payload.role !== "admin" ||
        payload.username !== process.env.ADMIN_USERNAME) {
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

app.post("/api/admin/login", (req, res) => {
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

    const usernameMatches = username === process.env.ADMIN_USERNAME;
    const passwordMatches = bcrypt.compareSync(
      password,
      process.env.ADMIN_PASSWORD_HASH
    );

    if (!usernameMatches || !passwordMatches) {
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

    return res.json({
      success: true,
      message: "Administrator login successful.",
      token,
      expiresIn: 7200,
      admin: { username: process.env.ADMIN_USERNAME }
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to sign in."
    });
  }
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Arthur's Mall API",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    service: "Arthur's Mall API",
    timestamp: new Date().toISOString(),
  });
});


// Protected product management routes

app.get("/api/admin/products", requireAdmin, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, brand, model, description, specifications,
             price, category, image_url, stock, active, created_at
      FROM products ORDER BY id DESC
    `).all().map(product => {
      let specifications = {};
      try {
        specifications = JSON.parse(product.specifications || "{}");
      } catch {}
      return { ...product, specifications };
    });

    res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error("Admin products error:", error.message);
    res.status(500).json({ success: false, message: "Unable to retrieve products." });
  }
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  try {
    const b = req.body || {};
    const { name, brand, model, price, stock } = b;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 150 ||
        typeof brand !== "string" || !brand.trim() || brand.trim().length > 80 ||
        typeof model !== "string" || !model.trim() || model.trim().length > 100) {
      return res.status(400).json({
        success: false, message: "Valid name, brand and model are required."
      });
    }

    if (!Number.isSafeInteger(price) || price < 0 ||
        !Number.isSafeInteger(stock) || stock < 0) {
      return res.status(400).json({
        success: false, message: "Price and stock must be non-negative whole numbers."
      });
    }

    const description = b.description === undefined ? "" : b.description;
    const category = b.category === undefined ? "Smartphones" : b.category;
    const imageUrl = b.image_url === undefined ? "" : b.image_url;
    const specifications = b.specifications === undefined ? {} : b.specifications;

    if (typeof description !== "string" || description.length > 5000 ||
        typeof category !== "string" || category.length > 80 ||
        typeof imageUrl !== "string" || imageUrl.length > 2000 ||
        !specifications || typeof specifications !== "object" ||
        Array.isArray(specifications) ||
        Buffer.byteLength(JSON.stringify(specifications), "utf8") > 10000) {
      return res.status(400).json({
        success: false, message: "Invalid description, category, image or specifications."
      });
    }

    const result = db.prepare(`
      INSERT INTO products
        (name, brand, model, description, specifications, price,
         category, image_url, stock, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      name.trim(), brand.trim(), model.trim(), description,
      JSON.stringify(specifications), price,
      category.trim() || "Smartphones", imageUrl.trim(), stock
    );

    res.status(201).json({
      success: true,
      message: "Product added successfully.",
      productId: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error("Add product error:", error.message);
    res.status(500).json({ success: false, message: "Unable to add product." });
  }
});

app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const current = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!current) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const b = req.body || {};
    const name = b.name === undefined ? current.name : b.name;
    const brand = b.brand === undefined ? current.brand : b.brand;
    const model = b.model === undefined ? current.model : b.model;
    const description = b.description === undefined ? current.description : b.description;
    const category = b.category === undefined ? current.category : b.category;
    const imageUrl = b.image_url === undefined ? current.image_url : b.image_url;
    const price = b.price === undefined ? current.price : b.price;
    const stock = b.stock === undefined ? current.stock : b.stock;
    const specs = b.specifications === undefined
      ? current.specifications : JSON.stringify(b.specifications);

    if (typeof name !== "string" || !name.trim() || name.length > 150 ||
        typeof brand !== "string" || !brand.trim() || brand.length > 80 ||
        typeof model !== "string" || !model.trim() || model.length > 100 ||
        typeof description !== "string" || description.length > 5000 ||
        typeof category !== "string" || category.length > 80 ||
        typeof imageUrl !== "string" || imageUrl.length > 2000 ||
        !Number.isSafeInteger(price) || price < 0 ||
        !Number.isSafeInteger(stock) || stock < 0) {
      return res.status(400).json({
        success: false, message: "One or more product fields are invalid."
      });
    }

    if (b.specifications !== undefined &&
        (!b.specifications || typeof b.specifications !== "object" ||
         Array.isArray(b.specifications) ||
         Buffer.byteLength(specs, "utf8") > 10000)) {
      return res.status(400).json({
        success: false, message: "Specifications must be a JSON object under 10 KB."
      });
    }

    db.prepare(`
      UPDATE products SET name = ?, brand = ?, model = ?, description = ?,
        specifications = ?, price = ?, category = ?, image_url = ?, stock = ?
      WHERE id = ?
    `).run(name.trim(), brand.trim(), model.trim(), description, specs,
      price, category.trim() || "Smartphones", imageUrl.trim(), stock, id);

    res.json({ success: true, message: "Product updated successfully." });
  } catch (error) {
    console.error("Update product error:", error.message);
    res.status(500).json({ success: false, message: "Unable to update product." });
  }
});

app.patch("/api/admin/products/:id/stock", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { stock } = req.body || {};

  if (!Number.isSafeInteger(id) || id < 1 ||
      !Number.isSafeInteger(stock) || stock < 0) {
    return res.status(400).json({
      success: false, message: "Provide a valid product ID and stock quantity."
    });
  }

  const result = db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(stock, id);
  if (Number(result.changes) !== 1) {
    return res.status(404).json({ success: false, message: "Product not found." });
  }

  res.json({ success: true, message: "Inventory updated successfully." });
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "Invalid product ID." });
  }

  const result = db.prepare(
    "UPDATE products SET active = 0 WHERE id = ? AND active = 1"
  ).run(id);

  if (Number(result.changes) !== 1) {
    return res.status(404).json({ success: false, message: "Active product not found." });
  }

  res.json({
    success: true,
    message: "Product deactivated. Existing order records are preserved."
  });
});


// Protected order management

app.get("/api/admin/orders", requireAdmin, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT
        o.id,
        o.customer_name,
        o.customer_phone,
        o.delivery_address,
        o.product_id,
        o.quantity,
        o.unit_price,
        o.total_price,
        o.payment_method,
        o.status,
        o.created_at,
        p.name AS product_name,
        p.brand AS product_brand,
        p.model AS product_model
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      ORDER BY o.id DESC
    `).all();

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error("Admin orders error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve orders."
    });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};

  const allowedStatuses = [
    "Pending",
    "Confirmed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
  ];

  if (!Number.isSafeInteger(id) || id < 1) {
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

  try {
    db.exec("BEGIN IMMEDIATE");

    try {
      const order = db.prepare(`
        SELECT id, product_id, quantity, status
        FROM orders
        WHERE id = ?
      `).get(id);

      if (!order) {
        db.exec("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Order not found."
        });
      }

      if (order.status === "Cancelled") {
        db.exec("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Cancelled orders cannot be changed."
        });
      }

      if (order.status === "Delivered" && status !== "Delivered") {
        db.exec("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Delivered orders cannot be changed."
        });
      }

      if (order.status === "Shipped" && status === "Cancelled") {
        db.exec("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "A shipped order cannot be cancelled here. Resolve its delivery first."
        });
      }

      if (status === "Cancelled" && order.status !== "Cancelled") {
        db.prepare(`
          UPDATE products
          SET stock = stock + ?
          WHERE id = ?
        `).run(order.quantity, order.product_id);
      }

      db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
      `).run(status, id);

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    res.json({
      success: true,
      message: "Order status updated successfully.",
      order: { id, status }
    });
  } catch (error) {
    console.error("Update order status error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update order status."
    });
  }
});

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END), 0) AS active_products,
        COALESCE(SUM(CASE WHEN active = 1 THEN stock ELSE 0 END), 0) AS units_in_stock,
        COALESCE(SUM(CASE WHEN active = 1 AND stock <= 5 THEN 1 ELSE 0 END), 0) AS low_stock
      FROM products
    `).get();

    const orders = db.prepare(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending_orders,
        COALESCE(SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders,
        COALESCE(SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'Delivered' THEN total_price ELSE 0 END), 0) AS delivered_sales
      FROM orders
    `).get();

    res.json({
      success: true,
      stats: { ...products, ...orders, currency: "GHS" }
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard statistics."
    });
  }
});

app.get("/api/products", (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        id,
        name,
        brand,
        model,
        description,
        specifications,
        price,
        category,
        image_url,
        stock,
        active,
        created_at
      FROM products
      WHERE active = 1
      ORDER BY id DESC
    `).all();

    const formattedProducts = products.map((product) => ({
      ...product,
      specifications: (() => {
        try {
          return JSON.parse(product.specifications || "{}");
        } catch {
          return {};
        }
      })(),
    }));

    res.json({
      success: true,
      count: formattedProducts.length,
      products: formattedProducts,
    });
  } catch (error) {
    console.error("Products error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
});

app.post("/api/orders", (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      productId,
      quantity,
    } = req.body || {};

    if (
      typeof customerName !== "string" ||
      customerName.trim().length < 2 ||
      customerName.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid customer name.",
      });
    }

    if (
      typeof customerPhone !== "string" ||
      !/^[+0-9()\-\s]{7,20}$/.test(customerPhone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number.",
      });
    }

    if (
      typeof deliveryAddress !== "string" ||
      deliveryAddress.trim().length < 5 ||
      deliveryAddress.trim().length > 300
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid delivery address.",
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
        message: "Invalid product or quantity. Quantity must be 1–10.",
      });
    }

    const product = db.prepare(`
      SELECT id, name, price, stock
      FROM products
      WHERE id = ? AND active = 1
    `).get(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.stock < quantity) {
      return res.status(409).json({
        success: false,
        message: "Insufficient stock available.",
      });
    }

    const totalPrice = product.price * quantity;

    if (!Number.isSafeInteger(totalPrice)) {
      return res.status(400).json({
        success: false,
        message: "Order total is invalid.",
      });
    }

    db.exec("BEGIN IMMEDIATE");

let orderId;

try {
  const result = db.prepare(`
    INSERT INTO orders (
      customer_name,
      customer_phone,
      delivery_address,
      product_id,
      quantity,
      unit_price,
      total_price
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    customerName.trim(),
    customerPhone.trim(),
    deliveryAddress.trim(),
    product.id,
    quantity,
    product.price,
    totalPrice
  );

  const stockResult = db.prepare(`
    UPDATE products
    SET stock = stock - ?
    WHERE id = ? AND stock >= ?
  `).run(quantity, product.id, quantity);

  if (Number(stockResult.changes) !== 1) {
    throw new Error("Stock changed or insufficient stock.");
  }

  orderId = Number(result.lastInsertRowid);

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

    return res.status(201).json({
      success: true,
      message: "Order received successfully.",
      order: {
        id: orderId,
        product: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice,
        currency: "GHS",
        status: "Pending",
        paymentMethod: "Pay on delivery",
      },
    });
  } catch (error) {
    console.error("Create order error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to create order. Please try again.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Arthur's Mall API running on port ${PORT}`);
});
