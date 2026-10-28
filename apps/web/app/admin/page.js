"use client";

import { useCallback, useEffect, useState } from "react";
import "./admin.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

const EMPTY_PRODUCT = {
  name: "",
  brand: "",
  model: "",
  price: "",
  stock: "",
  category: "Smartphones",
  description: "",
  image_url: "",
  specifications: "{}",
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("overview");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setToken("");
      setProducts([]);
      localStorage.removeItem("arthurs_admin_token");
      throw new Error("Your session expired. Please sign in again.");
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || "The request failed.");
    }

    return data;
  }, [token]);

  const loadProducts = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const data = await request("/api/admin/products");
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [token, request]);

  const loadOrders = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const data = await request("/api/admin/orders");
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message || "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [token, request]);

  async function updateOrderStatus(order, status) {
    if (status === "Cancelled") {
      const confirmed = window.confirm(
        `Cancel order #${order.id}? Its quantity will be returned to inventory.`
      );
      if (!confirmed) return;
    }

    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/admin/orders/${order.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setMessage(data.message || "Order status updated.");
      await loadOrders();
    } catch (err) {
      setError(err.message || "Could not update order status.");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("arthurs_admin_token");

    if (!saved) {
      setChecking(false);
      return;
    }

    fetch(`${API}/api/admin/me`, {
      headers: { Authorization: `Bearer ${saved}` },
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error("Session expired");
        }

        setToken(saved);
        setChecking(false);
      })
      .catch(() => {
        localStorage.removeItem("arthurs_admin_token");
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    if (token) loadProducts();
  }, [token, loadProducts]);

  useEffect(() => {
    if (token && section === "orders") loadOrders();
  }, [token, section, loadOrders]);

  async function login(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.message || "Login failed.");
      }

      localStorage.setItem("arthurs_admin_token", data.token);
      setToken(data.token);
      setPassword("");
      setMessage("Welcome to Arthur's Mall.");
    } catch (err) {
      setError(err.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("arthurs_admin_token");
    setToken("");
    setProducts([]);
    setPassword("");
    setUsername("");
    setShowForm(false);
    setMessage("");
    setError("");
  }

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_PRODUCT });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      brand: product.brand || "",
      model: product.model || "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      category: product.category || "Smartphones",
      description: product.description || "",
      image_url: product.image_url || "",
      specifications: JSON.stringify(product.specifications || {}, null, 2),
    });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));

    if (name === "image_url") {
      setImagePreview(value);
    }
  }

  async function uploadProductPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }

    setError("");
    setMessage("");
    setImageUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("upload_preset", "Spibody");
      body.append("folder", "arthurs-mall/products");

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/pdp9ap6f/image/upload",
        { method: "POST", body }
      );

      const data = await response.json();

      if (!response.ok || !data.secure_url) {
        throw new Error(
          data.error?.message || "Photo upload failed. Check your Cloudinary preset."
        );
      }

      setForm(current => ({ ...current, image_url: data.secure_url }));
      setImagePreview(data.secure_url);
      setMessage("Photo uploaded successfully.");
    } catch (err) {
      setError(err.message || "Could not upload the photo.");
    } finally {
      setImageUploading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    let specifications;

    try {
      specifications = JSON.parse(form.specifications || "{}");
      if (
        !specifications ||
        typeof specifications !== "object" ||
        Array.isArray(specifications)
      ) {
        throw new Error();
      }
    } catch {
      setError("Specifications must be a valid JSON object.");
      return;
    }

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!Number.isSafeInteger(price) || price < 0 ||
        !Number.isSafeInteger(stock) || stock < 0) {
      setError("Price and stock must be whole numbers of zero or more.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      price,
      stock,
      category: form.category.trim() || "Smartphones",
      description: form.description,
      image_url: form.image_url.trim(),
      specifications,
    };

    setLoading(true);

    try {
      const path = editingId
        ? `/api/admin/products/${editingId}`
        : "/api/admin/products";

      const data = await request(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setMessage(data.message || "Product saved successfully.");
      setShowForm(false);
      setForm({ ...EMPTY_PRODUCT });
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err.message || "Could not save product.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStock(product) {
    const value = window.prompt(
      `Enter the new stock quantity for ${product.name}:`,
      String(product.stock)
    );

    if (value === null) return;

    if (!/^\d+$/.test(value.trim()) ||
        !Number.isSafeInteger(Number(value))) {
      setError("Enter a valid whole-number stock quantity.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/admin/products/${product.id}/stock`,
        {
          method: "PATCH",
          body: JSON.stringify({ stock: Number(value) }),
        }
      );

      setMessage(data.message || "Inventory updated.");
      await loadProducts();
    } catch (err) {
      setError(err.message || "Could not update stock.");
    }
  }

  async function deactivateProduct(product) {
    const confirmed = window.confirm(
      `Deactivate "${product.name}"? It will no longer be available in the active catalogue.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const data = await request(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });

      setMessage(data.message || "Product deactivated.");
      await loadProducts();
    } catch (err) {
      setError(err.message || "Could not deactivate product.");
    }
  }

  const activeProducts = products.filter(product => Number(product.active) === 1);
  const totalStock = activeProducts.reduce(
    (total, product) => total + Number(product.stock || 0), 0
  );
  const lowStock = activeProducts.filter(
    product => Number(product.stock) <= 5
  );

  const visibleProducts = products.filter(product => {
    const term = search.toLowerCase();

    return [
      product.name,
      product.brand,
      product.model,
      product.category,
    ].some(value => String(value || "").toLowerCase().includes(term));
  });

  if (checking) {
    return <main className="am-loading">Loading administrator session…</main>;
  }

  if (!token) {
    return (
      <main className="am-login-page">
        <div className="am-login-card">
          <a className="am-brand" href="/">ARTHUR'S<span> MALL.</span></a>
          <div className="am-login-mark">A</div>
          <p className="am-eyebrow">ADMINISTRATION</p>
          <h1>Welcome back.</h1>
          <p className="am-muted">
            Sign in to manage products and inventory.
          </p>

          {error && <div className="am-alert am-alert-error">{error}</div>}
          {message && <div className="am-alert am-alert-success">{message}</div>}

          <form onSubmit={login} className="am-login-form">
            <label>
              Username
              <input
                value={username}
                onChange={event => setUsername(event.target.value)}
                autoComplete="username"
                required
                maxLength={100}
                placeholder="Administrator username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                maxLength={200}
                placeholder="Your password"
              />
            </label>

            <button className="am-button am-button-primary am-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in securely →"}
            </button>
          </form>

          <a className="am-back-link" href="/">← Back to storefront</a>
          <p className="am-login-foot">ARTHUR'S MALL · ADMIN PORTAL</p>
        </div>
      </main>
    );
  }

  return (
    <main className="am-shell">
      <aside className="am-sidebar">
        <a className="am-brand" href="/">ARTHUR'S<span> MALL.</span></a>

        <div className="am-side-label">WORKSPACE</div>

        <button
          className={`am-nav-item ${section === "overview" ? "active" : ""}`}
          onClick={() => setSection("overview")}
        >
          <span>◫</span> Overview
        </button>

        <button
          className={`am-nav-item ${section === "products" ? "active" : ""}`}
          onClick={() => setSection("products")}
        >
          <span>▦</span> Products
        </button>

        <button
          className={`am-nav-item ${section === "inventory" ? "active" : ""}`}
          onClick={() => setSection("inventory")}
        >
          <span>▤</span> Inventory
        </button>

        <button
          className={`am-nav-item ${section === "orders" ? "active" : ""}`}
          onClick={() => setSection("orders")}
        >
          <span>▣</span> Orders
        </button>

        <div className="am-sidebar-bottom">
          <div className="am-admin-avatar">A</div>
          <div className="am-admin-info">
            <strong>Administrator</strong>
            <small>Store manager</small>
          </div>
          <button className="am-logout" onClick={logout} title="Sign out">↗</button>
        </div>
      </aside>

      <section className="am-main">
        <header className="am-topbar">
          <div>
            <p className="am-eyebrow">ARTHUR'S MALL / ADMIN</p>
            <h1>
              {section === "overview" ? "Store overview" :
               section === "products" ? "Product catalogue" :
               section === "inventory" ? "Inventory" : "Order management"}
            </h1>
          </div>
          <div className="am-top-actions">
            <span className="am-live-dot">● Online</span>
            <a href="/" className="am-store-link">View store ↗</a>
          </div>
        </header>

        {error && <div className="am-alert am-alert-error">{error}</div>}
        {message && <div className="am-alert am-alert-success">{message}</div>}

        {section === "overview" && (
          <>
            <div className="am-welcome">
              <div>
                <p className="am-eyebrow">YOUR BUSINESS, AT A GLANCE</p>
                <h2>Make every product count.</h2>
                <p>Manage your catalogue and keep your inventory up to date.</p>
              </div>
              <button className="am-button am-button-primary" onClick={startAdd}>
                + Add product
              </button>
            </div>

            <div className="am-stats-grid">
              <article className="am-stat-card">
                <span className="am-stat-icon">▦</span>
                <p>Active products</p>
                <strong>{activeProducts.length}</strong>
                <small>Products in your catalogue</small>
              </article>
              <article className="am-stat-card">
                <span className="am-stat-icon">▤</span>
                <p>Units in stock</p>
                <strong>{totalStock}</strong>
                <small>Across active products</small>
              </article>
              <article className="am-stat-card">
                <span className="am-stat-icon">!</span>
                <p>Low-stock items</p>
                <strong>{lowStock.length}</strong>
                <small>Five units or fewer</small>
              </article>
              <article className="am-stat-card">
                <span className="am-stat-icon">◉</span>
                <p>All product records</p>
                <strong>{products.length}</strong>
                <small>Including deactivated items</small>
              </article>
            </div>

            <section className="am-panel">
              <div className="am-panel-heading">
                <div>
                  <h2>Recent products</h2>
                  <p>Your latest catalogue records</p>
                </div>
                <button className="am-text-button" onClick={() => setSection("products")}>
                  View all →
                </button>
              </div>
              <ProductTable
                products={products.filter(p => Number(p.active) === 1).slice(0, 5)}
                onEdit={startEdit}
                onStock={updateStock}
                onDeactivate={deactivateProduct}
              />
            </section>
          </>
        )}

        {section === "products" && (
          <section className="am-panel">
            <div className="am-panel-heading am-products-heading">
              <div>
                <h2>All products</h2>
                <p>Add and manage phones from different brands.</p>
              </div>
              <button className="am-button am-button-primary" onClick={startAdd}>
                + Add product
              </button>
            </div>

            <input
              className="am-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, brand, model or category…"
            />

            <ProductTable
              products={visibleProducts}
              onEdit={startEdit}
              onStock={updateStock}
              onDeactivate={deactivateProduct}
            />
          </section>
        )}

        {section === "orders" && (
          <section className="am-panel">
            <div className="am-panel-heading am-products-heading">
              <div>
                <h2>Customer orders</h2>
                <p>Review orders and keep their status up to date.</p>
              </div>
              <button
                className="am-button am-button-outline"
                onClick={loadOrders}
                disabled={loading}
              >
                ↻ Refresh
              </button>
            </div>

            <div className="am-order-filters">
              <input
                className="am-search"
                value={orderSearch}
                onChange={event => setOrderSearch(event.target.value)}
                placeholder="Search order ID, customer or phone…"
              />
              <select
                className="am-order-filter"
                value={orderFilter}
                onChange={event => setOrderFilter(event.target.value)}
                aria-label="Filter orders by status"
              >
                {["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => (
                  <option key={status} value={status}>{status === "All" ? "All statuses" : status}</option>
                ))}
              </select>
            </div>

            {loading && <p className="am-empty">Loading orders…</p>}

            {!loading && (
              <div className="am-table-wrap">
                <table className="am-table am-orders-table">
                  <thead>
                    <tr>
                      <th>ORDER</th>
                      <th>CUSTOMER</th>
                      <th>PRODUCT</th>
                      <th>TOTAL</th>
                      <th>STATUS</th>
                      <th>UPDATE STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.filter(order => {
                      const term = orderSearch.trim().toLowerCase();
                      const matchesSearch = [
                        order.id,
                        order.customer_name,
                        order.customer_phone,
                        order.product_name,
                      ].some(value => String(value || "").toLowerCase().includes(term));
                      return matchesSearch &&
                        (orderFilter === "All" || order.status === orderFilter);
                    }).map(order => (
                      <tr key={order.id}>
                        <td>
                          <strong>#{order.id}</strong>
                          <small>{order.created_at}</small>
                        </td>
                        <td>
                          <strong>{order.customer_name}</strong>
                          <small>{order.customer_phone}</small>
                          <small>{order.delivery_address}</small>
                        </td>
                        <td>
                          <strong>{order.product_name || `Product #${order.product_id}`}</strong>
                          <small>{order.product_brand || ""} {order.product_model || ""}</small>
                          <small>Qty: {order.quantity}</small>
                        </td>
                        <td className="am-price">
                          GH₵ {Number(order.total_price).toLocaleString()}
                          <small>{order.payment_method}</small>
                        </td>
                        <td>
                          <span className={`am-status ${order.status === "Delivered" ? "enabled" : order.status === "Cancelled" ? "disabled" : "pending"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          {order.status === "Cancelled" || order.status === "Delivered" ? (
                            <span className="am-muted">No further changes</span>
                          ) : (
                            <select
                              className="am-order-status-select"
                              value={order.status}
                              onChange={event => updateOrderStatus(order, event.target.value)}
                              aria-label={`Update order ${order.id} status`}
                            >
                              {["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {orders.filter(order => {
                  const term = orderSearch.trim().toLowerCase();
                  return [
                    order.id,
                    order.customer_name,
                    order.customer_phone,
                    order.product_name,
                  ].some(value => String(value || "").toLowerCase().includes(term)) &&
                    (orderFilter === "All" || order.status === orderFilter);
                }).length === 0 && (
                  <div className="am-empty">
                    {orders.length ? "No orders match your search." : "No customer orders have been placed yet."}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {section === "inventory" && (
          <section className="am-panel">
            <div className="am-panel-heading">
              <div>
                <h2>Stock control</h2>
                <p>Review quantities and update inventory.</p>
              </div>
              <button className="am-button am-button-outline" onClick={loadProducts}>
                ↻ Refresh
              </button>
            </div>

            <div className="am-inventory-list">
              {activeProducts.map(product => (
                <article className="am-inventory-row" key={product.id}>
                  <div className="am-product-thumb">
                    {product.image_url
                      ? <img src={product.image_url} alt="" />
                      : <span>▦</span>}
                  </div>
                  <div className="am-inventory-name">
                    <strong>{product.name}</strong>
                    <small>{product.brand} · {product.model}</small>
                  </div>
                  <div className={`am-stock-pill ${Number(product.stock) <= 5 ? "low" : ""}`}>
                    {product.stock} units
                  </div>
                  <button className="am-button am-button-outline" onClick={() => updateStock(product)}>
                    Update
                  </button>
                </article>
              ))}
              {activeProducts.length === 0 && (
                <p className="am-empty">No active products found.</p>
              )}
            </div>
          </section>
        )}

        <footer className="am-footer">
          <span>© {new Date().getFullYear()} Arthur's Mall</span>
          <span>ADMIN PORTAL · INVENTORY MANAGEMENT</span>
        </footer>
      </section>

      {showForm && (
        <div className="am-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setShowForm(false);
        }}>
          <section className="am-modal">
            <div className="am-modal-heading">
              <div>
                <p className="am-eyebrow">{editingId ? "EDIT LISTING" : "NEW LISTING"}</p>
                <h2>{editingId ? "Update product" : "Add a product"}</h2>
              </div>
              <button className="am-close" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            {error && <div className="am-alert am-alert-error">{error}</div>}

            <form onSubmit={saveProduct} className="am-product-form">
              <div className="am-form-grid">
                <label>
                  Product name *
                  <input name="name" value={form.name} onChange={updateField} required maxLength={150} placeholder="e.g. Samsung Galaxy A16" />
                </label>
                <label>
                  Brand *
                  <input name="brand" value={form.brand} onChange={updateField} required maxLength={80} placeholder="e.g. Samsung" />
                </label>
                <label>
                  Model *
                  <input name="model" value={form.model} onChange={updateField} required maxLength={100} placeholder="e.g. Galaxy A16" />
                </label>
                <label>
                  Category
                  <input name="category" value={form.category} onChange={updateField} maxLength={80} placeholder="Smartphones" />
                </label>
                <label>
                  Price (GH₵) *
                  <input name="price" type="number" min="0" step="1" value={form.price} onChange={updateField} required />
                </label>
                <label>
                  Stock quantity *
                  <input name="stock" type="number" min="0" step="1" value={form.stock} onChange={updateField} required />
                </label>
              </div>

              <div className="am-photo-upload">
                <label htmlFor="product-photo">Product photo</label>
                <input
                  id="product-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadProductPhoto}
                  disabled={imageUploading || loading}
                />
                <small className="am-field-help">
                  Choose a JPG, PNG, or WebP photo from your phone. Maximum 5 MB.
                </small>

                {imageUploading && (
                  <p role="status">Uploading photo… Please wait.</p>
                )}

                {imagePreview && (
                  <div className="am-photo-preview">
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      style={{
                        display: "block",
                        width: "160px",
                        height: "160px",
                        objectFit: "contain",
                        borderRadius: "12px",
                        marginTop: "12px",
                      }}
                    />
                  </div>
                )}

                <label htmlFor="product-image-url">Image URL (optional)</label>
                <input
                  id="product-image-url"
                  name="image_url"
                  type="url"
                  value={form.image_url}
                  onChange={updateField}
                  placeholder="Uploaded image URL appears here"
                />
              </div>

              <label>
                Description
                <textarea name="description" rows="3" maxLength={5000} value={form.description} onChange={updateField} placeholder="Describe the product…" />
              </label>

              <label>
                Specifications (JSON)
                <textarea name="specifications" rows="4" value={form.specifications} onChange={updateField} spellCheck="false" />
                <small className="am-field-help">Example: {"{ \"display\": \"6.7 inches\", \"battery\": \"5000mAh\" }"}</small>
              </label>

              <div className="am-form-actions">
                <button type="button" className="am-button am-button-outline" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="am-button am-button-primary" disabled={loading || imageUploading}>
                  {loading ? "Saving…" : editingId ? "Save changes" : "Add product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function ProductTable({ products, onEdit, onStock, onDeactivate }) {
  if (!products.length) {
    return <div className="am-empty">No products to display.</div>;
  }

  return (
    <div className="am-table-wrap">
      <table className="am-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>PRICE</th>
            <th>STOCK</th>
            <th>STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => {
            const active = Number(product.active) === 1;

            return (
              <tr key={product.id}>
                <td>
                  <div className="am-product-cell">
                    <div className="am-product-thumb">
                      {product.image_url
                        ? <img src={product.image_url} alt="" />
                        : <span>▦</span>}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.brand} · {product.model}</small>
                    </div>
                  </div>
                </td>
                <td className="am-price">GH₵ {Number(product.price).toLocaleString()}</td>
                <td>
                  <span className={`am-stock-pill ${Number(product.stock) <= 5 ? "low" : ""}`}>
                    {product.stock} units
                  </span>
                </td>
                <td>
                  <span className={`am-status ${active ? "enabled" : "disabled"}`}>
                    {active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="am-row-actions">
                    <button onClick={() => onEdit(product)} title="Edit product">Edit</button>
                    {active && <button onClick={() => onStock(product)} title="Update stock">Stock</button>}
                    {active && <button className="am-danger-text" onClick={() => onDeactivate(product)} title="Deactivate product">Remove</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
