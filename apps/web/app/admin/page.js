"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

const CLOUD_NAME = "pdp9ap6f";
const UPLOAD_PRESET = "Spibody";

const STATUSES = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const EMPTY_PRODUCT = {
  name: "",
  brand: "",
  model: "",
  category: "Smartphones",
  price: "",
  stock: "",
  image_url: "",
  images: [],
  description: "",
  specifications: '{\n  "display": "",\n  "battery": ""\n}',
};

function money(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function date(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Status({ value }) {
  const key = String(value || "Pending").toLowerCase();

  return (
    <span className={`am-status am-status-${key}`}>
      {value || "Pending"}
    </span>
  );
}

function Metric({ label, value, detail, icon }) {
  return (
    <article className="am-metric">
      <div className="am-metric-top">
        <span>{label}</span>
        <span className="am-metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [stats, setStats] = useState({});
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [section, setSection] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [imageViewer, setImageViewer] = useState(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [search, setSearch] = useState("");

  const [orderSearch, setOrderSearch] = useState("");
  const [productFilter, setProductFilter] = useState("All");

  // ADMIN_IMAGE_VIEWER_KEYBOARD
  useEffect(() => {
    if (!imageViewer) return;

    function handleViewerKeys(event) {
      if (event.key === "Escape") setImageViewer(null);
      if (event.key === "ArrowRight") {
        setImageViewer(current => current ? {
          ...current,
          index: (current.index + 1) % current.images.length
        } : null);
      }
      if (event.key === "ArrowLeft") {
        setImageViewer(current => current ? {
          ...current,
          index: (current.index - 1 + current.images.length) % current.images.length
        } : null);
      }
    }

    document.addEventListener("keydown", handleViewerKeys);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleViewerKeys);
      document.body.style.overflow = oldOverflow;
    };
  }, [imageViewer]);


  const request = useCallback(
    async (path, options = {}, auth = true) => {
      const headers = {
        ...(options.headers || {}),
      };

      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      if (auth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API}${path}`, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message || `Request failed (${response.status})`
        );
      }

      return data;
    },
    [token]
  );

  const loadDashboard = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const [statsData, productData, orderData] = await Promise.all([
        request("/api/admin/stats"),
        request("/api/admin/products"),
        request("/api/admin/orders"),
      ]);

      setStats(statsData.stats || {});
      setProducts(productData.products || []);
      setOrders(orderData.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, request]);

  useEffect(() => {
    if (token) loadDashboard();
  }, [token, loadDashboard]);

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await request(
        "/api/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
        false
      );

      if (!data.token) {
        throw new Error("The server did not return an admin token.");
      }

      setToken(data.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setStats({});
    setProducts([]);
    setOrders([]);
    setSection("Overview");
    setNotice("");
    setError("");
  }

  function openNewProduct() {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_PRODUCT });
    setShowProductForm(true);
    setError("");
  }

  function openEditProduct(product) {
    setEditingProduct(product);

    setProductForm({
      name: product.name || "",
      brand: product.brand || "",
      model: product.model || "",
      category: product.category || "Smartphones",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      image_url: product.image_url || "",
      images: Array.isArray(product.images)
        ? product.images.slice(0, 4)
        : (product.image_url ? [product.image_url] : []),
      description: product.description || "",
      specifications: JSON.stringify(
        product.specifications || {},
        null,
        2
      ),
    });

    setShowProductForm(true);
    setError("");
  }

  function updateProductField(field, value) {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.name,
          product.brand,
          product.model,
          product.category,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        productFilter === "All" ||
        (productFilter === "Active" && Number(product.active) === 1) ||
        (productFilter === "Inactive" && Number(product.active) === 0) ||
        (productFilter === "Low stock" &&
          Number(product.active) === 1 &&
          Number(product.stock) <= 5);

      return matchesSearch && matchesFilter;
    });
  }, [products, search, productFilter]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    return orders.filter((order) =>
      [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.product_name,
        order.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [orders, orderSearch]);


  async function uploadImage(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const existingCount =
      (productForm.images || []).length;

    if (existingCount + files.length > 4) {
      setError("You can add up to four product images.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError("Choose JPG, PNG or WEBP images only.");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is larger than 5MB.`);
        return;
      }
    }

    const previews = files.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setPreviewImages(previews);
    setUploading(true);
    setError("");
    setNotice("Previewing selected images...");

    try {
      const uploaded = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        const result = await response.json();

        if (!response.ok || !result.secure_url) {
          throw new Error(
            result.error?.message || `Upload failed for ${file.name}.`
          );
        }

        uploaded.push(result.secure_url);
      }

      setProductForm(current => {
        const nextImages = [
          ...(current.images || []),
          ...uploaded,
        ].slice(0, 4);

        return {
          ...current,
          images: nextImages,
          image_url: nextImages[0] || "",
        };
      });

      setNotice(`${uploaded.length} image(s) uploaded successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      previews.forEach(item => URL.revokeObjectURL(item.url));
      setPreviewImages([]);
      setUploading(false);
    }
  }

  function removeProductImage(index) {
    setProductForm((current) => {
      const nextImages = (current.images || []).filter(
        (_, imageIndex) => imageIndex !== index
      );

      return {
        ...current,
        images: nextImages,
        image_url: nextImages[0] || "",
      };
    });
  }

  async function saveProduct(event) {
    event.preventDefault();

    if (saving || uploading) return;

    setError("");
    setNotice("");

    const price = Number(productForm.price);
    const stock = Number(productForm.stock);

    if (
      !Number.isSafeInteger(price) ||
      price < 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      setError("Price and stock must be valid whole numbers.");
      return;
    }

    let specifications;

    try {
      specifications = JSON.parse(
        productForm.specifications || "{}"
      );

      if (
        !specifications ||
        typeof specifications !== "object" ||
        Array.isArray(specifications)
      ) {
        throw new Error("Specifications must be a JSON object.");
      }
    } catch {
      setError("Enter valid JSON for product specifications.");
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      brand: productForm.brand.trim(),
      model: productForm.model.trim(),
      category: productForm.category.trim() || "Smartphones",
      price,
      stock,
      image_url: (productForm.images?.[0] || productForm.image_url || "").trim(),
      images: (productForm.images || []).slice(0, 4),
      description: productForm.description.trim(),
      specifications,
    };

    setSaving(true);

    try {
      const path = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : "/api/admin/products";

      await request(path, {
        method: editingProduct ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({ ...EMPTY_PRODUCT });

      setNotice(
        editingProduct
          ? "Product updated successfully."
          : "Product added successfully."
      );

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateProduct(product) {
    const confirmed = window.confirm(
      `Deactivate "${product.name}"? It will no longer appear in the public catalogue.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await request(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });

      setNotice("Product deactivated successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStock(product, value) {
    const stock = Number(value);

    if (!Number.isSafeInteger(stock) || stock < 0) {
      setError("Enter a valid non-negative stock quantity.");
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(
        `/api/admin/products/${product.id}/stock`,
        {
          method: "PATCH",
          body: JSON.stringify({ stock }),
        }
      );

      setNotice(`Stock updated for ${product.name}.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(orderId, status) {
    setError("");
    setNotice("");

    try {
      await request(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setNotice(`Order #${orderId} updated to ${status}.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) {
    return (
      <main className="am-login">
        <form className="am-login-card" onSubmit={login}>
          <div className="am-brand-mark">A<span>M</span></div>

          <p className="am-eyebrow">ARTHUR MALL</p>
          <h1>Admin portal</h1>
          <p className="am-muted">
            Sign in to manage your store.
          </p>

          {error && (
            <div className="am-alert am-alert-error">{error}</div>
          )}

          <label>
            Username
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Administrator username"
            />
          </label>

          <label>
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>

          <button className="am-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to dashboard"}
          </button>

          <small className="am-small">
            Secure administrator access
          </small>
        </form>
      </main>
    );
  }


  return (
    <main className="am-dashboard">
      <aside className="am-sidebar">
        <a href="/admin" className="am-sidebar-brand">
          <span className="am-brand-mark">A<span>M</span></span>
          <span>
            <strong>ARTHUR MALL</strong>
            <small>STORE MANAGEMENT</small>
          </span>
        </a>

        <div className="am-sidebar-label">WORKSPACE</div>

        <nav className="am-navigation">
          {[
            ["Overview", "▦"],
            ["Products", "◇"],
            ["Orders", "⇄"],
          ].map(([name, icon]) => (
            <button
              key={name}
              className={section === name ? "active" : ""}
              onClick={() => {
                setSection(name);
                setError("");
              }}
            >
              <span>{icon}</span>
              {name}
              {name === "Orders" && stats.pending_orders > 0 && (
                <b>{stats.pending_orders}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="am-sidebar-bottom">
          <div className="am-admin-profile">
            <span className="am-avatar">A</span>
            <span>
              <strong>Administrator</strong>
              <small>Store manager</small>
            </span>
          </div>

          <button className="am-logout" onClick={logout}>
            ↗ Sign out
          </button>
        </div>
      </aside>

      <section className="am-main">
        <header className="am-topbar">
          <div>
            <p className="am-eyebrow">ARTHUR MALL / MANAGEMENT</p>
            <h1>{section}</h1>
          </div>

          <div className="am-topbar-actions">
            <span className="am-live-indicator">
              <i /> Store dashboard
            </span>
            <button
              className="am-refresh"
              onClick={loadDashboard}
              disabled={loading}
            >
              ↻ <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="am-content">
          {error && (
            <div className="am-alert am-alert-error">
              <span>{error}</span>
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {notice && (
            <div className="am-alert am-alert-success">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}

          {loading && (
            <div className="am-loading">
              <span className="am-spinner" />
              Loading store information...
            </div>
          )}

          {section === "Overview" && (
            <>
              <div className="am-welcome">
                <div>
                  <span className="am-welcome-tag">YOUR STORE AT A GLANCE</span>
                  <h2>Welcome back.</h2>
                  <p>
                    Here's what's happening with your store today.
                  </p>
                </div>
                <button
                  className="am-primary"
                  onClick={() => {
                    setSection("Products");
                    openNewProduct();
                  }}
                >
                  + Add product
                </button>
              </div>

              <div className="am-metrics-grid">
                <Metric
                  label="Total orders"
                  value={stats.total_orders ?? 0}
                  detail={`${stats.pending_orders ?? 0} awaiting attention`}
                  icon="⇄"
                />
                <Metric
                  label="Delivered sales"
                  value={money(stats.delivered_sales)}
                  detail={`${stats.delivered_orders ?? 0} delivered orders`}
                  icon="₵"
                />
                <Metric
                  label="Active products"
                  value={stats.active_products ?? 0}
                  detail={`${stats.total_products ?? 0} total products`}
                  icon="◇"
                />
                <Metric
                  label="Units in stock"
                  value={stats.units_in_stock ?? 0}
                  detail={`${stats.low_stock ?? 0} products running low`}
                  icon="▤"
                />
              </div>

              <div className="am-overview-grid">
                <section className="am-panel">
                  <div className="am-panel-heading">
                    <div>
                      <p className="am-eyebrow">LATEST ACTIVITY</p>
                      <h3>Recent orders</h3>
                    </div>
                    <button
                      className="am-text-button"
                      onClick={() => setSection("Orders")}
                    >
                      View all →
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="am-empty-state">
                      <span>⇄</span>
                      <h3>No orders yet</h3>
                      <p>New customer orders will appear here.</p>
                    </div>
                  ) : (
                    <div className="am-recent-list">
                      {orders.slice(0, 6).map((order) => (
                        <div className="am-recent-order" key={order.id}>
                          <div className="am-order-avatar">
                            {(order.customer_name || "C")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="am-order-info">
                            <strong>{order.customer_name}</strong>
                            <small>
                              #{order.id} · {order.product_name || "Product"}
                            </small>
                          </div>
                          <div className="am-order-value">
                            <strong>{money(order.total_price)}</strong>
                            <Status value={order.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="am-panel">
                  <div className="am-panel-heading">
                    <div>
                      <p className="am-eyebrow">INVENTORY HEALTH</p>
                      <h3>Stock overview</h3>
                    </div>
                    <span className="am-stock-icon">▤</span>
                  </div>

                  <div className="am-stock-summary">
                    <strong>{stats.units_in_stock ?? 0}</strong>
                    <span>Available units</span>
                  </div>

                  <div className="am-stock-warning">
                    <span>!</span>
                    <div>
                      <strong>{stats.low_stock ?? 0} low-stock products</strong>
                      <p>Products with five or fewer units remaining.</p>
                    </div>
                  </div>

                  <button
                    className="am-secondary-button am-full-button"
                    onClick={() => setSection("Products")}
                  >
                    Manage inventory →
                  </button>
                </section>
              </div>
            </>
          )}

          {section === "Products" && (
            <section className="am-panel">
              <div className="am-panel-heading am-products-heading">
                <div>
                  <p className="am-eyebrow">CATALOGUE MANAGEMENT</p>
                  <h3>Your products</h3>
                  <p>Manage products, prices and stock levels.</p>
                </div>
                <button className="am-primary" onClick={openNewProduct}>
                  + Add product
                </button>
              </div>

              <div className="am-toolbar">
                <input
                  className="am-search"
                  type="search"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  className="am-filter"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                >
                  {["All", "Active", "Inactive", "Low stock"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="am-empty-state">
                  <span>◇</span>
                  <h3>No products found</h3>
                  <p>Try another search or add a new product.</p>
                </div>
              ) : (
                <div className="am-product-grid">
                  {filteredProducts.map((product) => (
                    <article className="am-product-card" key={product.id}>
                      <div className="am-product-image">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                          />
                        ) : (
                          <span>◇</span>
                        )}
                        <Status
                          value={
                            Number(product.active) === 1
                              ? "Active"
                              : "Inactive"
                          }
                        />
                      </div>

                      <div className="am-product-details">
                        <small>
                          {product.brand} · {product.category}
                        </small>
                        <h4>{product.name}</h4>
                        <p>{product.model}</p>

                        <div className="am-product-price-row">
                          <strong>{money(product.price)}</strong>
                          <span
                            className={
                              Number(product.stock) <= 5
                                ? "am-stock-low"
                                : "am-stock-good"
                            }
                          >
                            {product.stock} in stock
                          </span>
                        </div>

                        <div className="am-product-actions">
                          <button
                            className="am-secondary-button"
                            onClick={() => openEditProduct(product)}
                          >
                            Edit
                          </button>

                          <button
                            className="am-danger-button"
                            onClick={() => deactivateProduct(product)}
                            disabled={Number(product.active) !== 1}
                          >
                            Deactivate
                          </button>
                        </div>

                        <label className="am-stock-editor">
                          Update stock
                          <input
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={product.stock}
                            key={`${product.id}-${product.stock}`}
                            onBlur={(e) => {
                              if (String(product.stock) !== e.target.value) {
                                updateStock(product, e.target.value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {section === "Orders" && (
            <section className="am-panel">
              <div className="am-panel-heading">
                <div>
                  <p className="am-eyebrow">SALES MANAGEMENT</p>
                  <h3>Customer orders</h3>
                  <p>Review purchases and update order statuses.</p>
                </div>
              </div>

              <div className="am-toolbar">
                <input
                  className="am-search"
                  type="search"
                  placeholder="Search orders, customers or phone..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>

              {filteredOrders.length === 0 ? (
                <div className="am-empty-state">
                  <span>⇄</span>
                  <h3>No orders found</h3>
                  <p>Customer purchases will appear here.</p>
                </div>
              ) : (
                <div className="am-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ORDER / CUSTOMER</th>
                        <th>PRODUCT</th>
                        <th>DATE</th>
                        <th>TOTAL</th>
                        <th>STATUS</th>
                        <th>UPDATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <strong>
                              #{order.id} · {order.customer_name}
                            </strong>
                            <small>{order.customer_phone}</small>
                            <small>{order.delivery_address}</small>
                          </td>
                          <td>
                            {order.product_name || "Product"}
                            <small>
                              {order.product_brand} · {order.product_model}
                            </small>
                            <small>Quantity: {order.quantity}</small>
                          </td>
                          <td>{date(order.created_at)}</td>
                          <td>
                            <strong>{money(order.total_price)}</strong>
                          </td>
                          <td>
                            <Status value={order.status} />
                          </td>
                          <td>
                            <select
                              className="am-status-select"
                              value={order.status}
                              onChange={(e) =>
                                changeStatus(order.id, e.target.value)
                              }
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="am-footer">
          <span>© {new Date().getFullYear()} ARTHUR MALL</span>
          <span>STORE MANAGEMENT SYSTEM</span>
        </footer>
      </section>

      {showProductForm && (
        <div
          className="am-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving && !uploading) {
              setShowProductForm(false);
            }
          }}
        >
          <form className="am-modal" onSubmit={saveProduct}>
            <div className="am-form-heading">
              <div>
                <p className="am-eyebrow">PRODUCT MANAGEMENT</p>
                <h2>{editingProduct ? "Edit product" : "Add new product"}</h2>
                <p>Enter product information and manage its image.</p>
              </div>

              <button
                type="button"
                className="am-close"
                onClick={() => setShowProductForm(false)}
                disabled={saving || uploading}
              >
                ×
              </button>
            </div>

            <div className="am-form-grid">
              <label>
                Product name *
                <input
                  required
                  maxLength={150}
                  value={productForm.name}
                  onChange={(e) => updateProductField("name", e.target.value)}
                  placeholder="e.g. Xiaomi Redmi 14C"
                />
              </label>

              <label>
                Brand *
                <input
                  required
                  maxLength={80}
                  value={productForm.brand}
                  onChange={(e) => updateProductField("brand", e.target.value)}
                  placeholder="e.g. Xiaomi"
                />
              </label>

              <label>
                Model *
                <input
                  required
                  maxLength={100}
                  value={productForm.model}
                  onChange={(e) => updateProductField("model", e.target.value)}
                  placeholder="e.g. Redmi 14C"
                />
              </label>

              <label>
                Category
                <input
                  maxLength={80}
                  value={productForm.category}
                  onChange={(e) => updateProductField("category", e.target.value)}
                  placeholder="Smartphones"
                />
              </label>

              <label>
                Price (GH₵) *
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={productForm.price}
                  onChange={(e) => updateProductField("price", e.target.value)}
                />
              </label>

              <label>
                Stock quantity *
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={productForm.stock}
                  onChange={(e) => updateProductField("stock", e.target.value)}
                />
              </label>

              <div className="am-image-uploader">
                <span className="am-field-title">
                  Product gallery ({(productForm.images || []).length}/4)
                </span>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                  marginTop: "12px"
                }}>
                  {[
                    ...(productForm.images || []).map((url, index) => ({
                      url,
                      name: `Image ${index + 1}`,
                      uploaded: true
                    })),
                    ...previewImages.map(item => ({
                      ...item,
                      uploaded: false
                    }))
                  ].map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      style={{
                        position: "relative",
                        minWidth: 0,
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: "#f1f3ed",
                        aspectRatio: "1 / 1"
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setImageViewer({
                          images: [
                            ...(productForm.images || []),
                            ...previewImages.map(item => item.url)
                          ],
                          index
                        })}
                        aria-label={`Enlarge product image ${index + 1}`}
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          cursor: "zoom-in"
                        }}
                      >
                        <img
                          src={item.url}
                          alt={`Product image ${index + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain"
                          }}
                        />
                      </button>

                      <span style={{
                        position: "absolute",
                        left: "7px",
                        top: "7px",
                        padding: "4px 7px",
                        borderRadius: "6px",
                        background: "#111",
                        color: "#fff",
                        fontSize: "11px"
                      }}>
                        {index === 0 ? "Main image" : `Image ${index + 1}`} {!item.uploaded && "(Preview)"}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeProductImage(index)}
                        disabled={uploading || saving || !item.uploaded}
                        aria-label={`Remove image ${index + 1}`}
                        style={{
                          position: "absolute",
                          right: "7px",
                          top: "7px",
                          width: "30px",
                          height: "30px",
                          border: 0,
                          borderRadius: "50%",
                          background: "#fff",
                          color: "#b42318",
                          fontSize: "18px",
                          cursor: "pointer"
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {(productForm.images || []).length === 0 && previewImages.length === 0 && (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "30px 12px",
                        textAlign: "center",
                        border: "1px dashed #aaa",
                        borderRadius: "12px"
                      }}
                    >
                      <span style={{ fontSize: "28px" }}>＋</span>
                      <p>No product images yet.</p>
                    </div>
                  )}
                </div>


                {/* ADMIN_IMAGE_VIEWER_MODAL */}
                {imageViewer && imageViewer.images.length > 0 && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Product image preview"
                    onClick={() => setImageViewer(null)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 100000,
                      background: "rgba(0,0,0,.94)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "65px 16px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setImageViewer(null)}
                      aria-label="Close image preview"
                      style={{
                        position: "absolute",
                        top: 16,
                        right: 18,
                        width: 46,
                        height: 46,
                        border: 0,
                        borderRadius: "50%",
                        background: "#fff",
                        color: "#111",
                        fontSize: 28,
                        cursor: "pointer"
                      }}
                    >×</button>

                    <span style={{
                      position: "absolute",
                      top: 30,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: "#fff"
                    }}>
                      {imageViewer.index + 1} / {imageViewer.images.length}
                    </span>

                    {imageViewer.images.length > 1 && (
                      <button
                        type="button"
                        aria-label="Previous image"
                        onClick={event => {
                          event.stopPropagation();
                          setImageViewer(current => ({
                            ...current,
                            index: (current.index - 1 + current.images.length) % current.images.length
                          }));
                        }}
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          fontSize: 32,
                          color: "#fff",
                          background: "#333",
                          border: 0,
                          borderRadius: 30,
                          width: 44,
                          height: 44
                        }}
                      >‹</button>
                    )}

                    <img
                      src={imageViewer.images[imageViewer.index]}
                      alt="Enlarged product"
                      onClick={event => event.stopPropagation()}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain"
                      }}
                    />

                    {imageViewer.images.length > 1 && (
                      <button
                        type="button"
                        aria-label="Next image"
                        onClick={event => {
                          event.stopPropagation();
                          setImageViewer(current => ({
                            ...current,
                            index: (current.index + 1) % current.images.length
                          }));
                        }}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          fontSize: 32,
                          color: "#fff",
                          background: "#333",
                          border: 0,
                          borderRadius: 30,
                          width: 44,
                          height: 44
                        }}
                      >›</button>
                    )}
                  </div>
                )}

                <label className="am-upload-button">
                  {uploading ? "Uploading images..." : "↑ Choose product images"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={uploadImage}
                    disabled={
                      uploading ||
                      saving ||
                      (productForm.images || []).length >= 4
                    }
                  />
                </label>

                <small>
                  Selected photos appear immediately as previews. Uploads are saved to your product gallery.
                  <br />Select up to four JPG, PNG or WEBP images.
                  Maximum 5MB per image.
                </small>
              </div>

              <label className="am-full-field">
                Description
                <textarea
                  rows="4"
                  maxLength={5000}
                  value={productForm.description}
                  onChange={(e) =>
                    updateProductField("description", e.target.value)
                  }
                  placeholder="Describe this product..."
                />
              </label>

              <label className="am-full-field">
                Specifications (JSON format)
                <textarea
                  rows="5"
                  value={productForm.specifications}
                  onChange={(e) =>
                    updateProductField("specifications", e.target.value)
                  }
                  placeholder={'{\n  "display": "6.88-inch",\n  "battery": "5160mAh"\n}'}
                />
                <small>Enter specifications as a valid JSON object.</small>
              </label>
            </div>

            <div className="am-form-actions">
              <button
                type="button"
                className="am-cancel-button"
                onClick={() => setShowProductForm(false)}
                disabled={saving || uploading}
              >
                Cancel
              </button>

              <button
                className="am-primary"
                disabled={saving || uploading}
              >
                {uploading
                  ? "Uploading..."
                  : saving
                    ? "Saving..."
                    : editingProduct
                      ? "Save changes"
                      : "Add product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
