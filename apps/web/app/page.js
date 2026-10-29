
"use client";

import { useEffect, useMemo, useState } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000";

const WHATSAPP_NUMBER = "233570848484";

function trackMetaEvent(eventName, data = {}) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, data);
  }
}

function formatMoney(amount) {
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `GH₵${formatted}`;
}

function getProductName(product) {
  return (
    product?.name ||
    [product?.brand, product?.model].filter(Boolean).join(" ") ||
    "Featured product"
  );
}

function ProductArtwork({ product }) {
  if (product?.image_url) {
    return (
      <img
        src={product.image_url}
        alt={getProductName(product)}
        className="product-artwork-image"
      />
    );
  }

  return (
    <div className="product-artwork-placeholder">
      <span className="artwork-label">
        {product?.brand || "ARTHUR MALL"}
      </span>
      <div className="phone-artwork">
        <div className="phone-camera camera-one" />
        <div className="phone-camera camera-two" />
        <div className="phone-camera camera-three" />
        <div className="phone-screen-glow" />
      </div>
      <span className="artwork-model">
        {product?.model || "SMARTPHONE"}
      </span>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const response = await fetch(`${API}/api/products`);
        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        const result = await response.json();
        const inventory = Array.isArray(result)
          ? result
          : result.products || [];

        const available = inventory.filter(
          (product) =>
            product.active !== 0 &&
            Number(product.stock ?? 1) > 0
        );

        if (active) {
          setProducts(available);
          setSelectedProduct(available[0] || null);
        }
      } catch (err) {
        if (active) {
          setError(
            "We couldn't load the catalogue. Please refresh the page."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(() => {
    return (
      (Number(selectedProduct?.price) || 0) *
      quantity
    );
  }, [selectedProduct, quantity]);

  function chooseProduct(product) {
    setSelectedProduct(product);
    setQuantity(1);
    setError("");
    setSuccess("");

    trackMetaEvent("ViewContent", {
      content_name: getProductName(product),
      content_ids: [String(product.id)],
      content_type: "product",
      value: Number(product.price) || 0,
      currency: "GHS",
    });
  }

  function updateCustomer(field, value) {
    setCustomer((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function changeQuantity(amount) {
    setQuantity((current) => {
      const maximum = Math.max(
        1,
        Number(selectedProduct?.stock) || 1
      );

      return Math.min(
        maximum,
        Math.max(1, current + amount)
      );
    });
  }

  function scrollToOrder() {
    if (!selectedProduct) return;

    trackMetaEvent("InitiateCheckout", {
      content_name: getProductName(selectedProduct),
      content_ids: [String(selectedProduct.id)],
      content_type: "product",
      value: total,
      currency: "GHS",
      num_items: quantity,
    });

    document
      .getElementById("order")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function submitOrder(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Please select a product first.");
      return;
    }

    if (
      !customer.name.trim() ||
      !customer.phone.trim() ||
      !customer.address.trim()
    ) {
      setError("Please complete all your delivery details.");
      return;
    }

    setSubmitting(true);

    const orderPayload = {
      customerName: customer.name.trim(),
      customerPhone: customer.phone.trim(),
      deliveryAddress: customer.address.trim(),
      productId: selectedProduct.id,
      quantity,
    };

    try {
      const response = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "We couldn't process your order."
        );
      }

      const order = result.order || result;
      const orderId =
        order.id || order.orderId || result.orderId || "Pending";

      trackMetaEvent("Purchase", {
        content_name: getProductName(selectedProduct),
        content_ids: [String(selectedProduct.id)],
        content_type: "product",
        value: total,
        currency: "GHS",
        num_items: quantity,
      });

      trackMetaEvent("Contact", {
        content_name: "WhatsApp order",
      });

      const message = [
        "Hello Arthur Mall! I want to place an order.",
        "",
        `Order ID: ${orderId}`,
        `Product: ${getProductName(selectedProduct)}`,
        `Quantity: ${quantity}`,
        `Unit price: ${formatMoney(selectedProduct.price)}`,
        `Total: ${formatMoney(total)}`,
        "",
        `Customer name: ${customer.name.trim()}`,
        `Phone: ${customer.phone.trim()}`,
        `Delivery address: ${customer.address.trim()}`,
        "Delivery: Free within Accra",
        "Payment: Pay on delivery",
      ].join("\n");

      setSuccess("Your order has been submitted. Opening WhatsApp…");

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=` +
        encodeURIComponent(message);

      window.location.href = whatsappUrl;
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="storefront">
      <div className="announcement-bar">
        <span className="announcement-dot" />
        FREE DELIVERY WITHIN ACCRA
        <span className="announcement-divider">·</span>
        PAY ON DELIVERY
      </div>

      <header className="site-header">
        <a href="#home" className="brand-lockup">
          <span className="brand-symbol">A</span>
          <span className="brand-name">
            ARTHUR <strong>MALL</strong>
          </span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#catalogue">Shop phones</a>
          <a href="#benefits">Why Arthur Mall</a>
        </nav>

        <a href="#catalogue" className="header-cta">
          Shop now <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-copy">
          <span className="eyebrow">
            YOUR NEXT PHONE STARTS HERE
          </span>

          <h1>
            Good tech.
            <br />
            <span>Great value.</span>
          </h1>

          <p className="hero-description">
            Discover smartphones made for your everyday life.
            Quality features, fair prices and a simple way to
            order from the comfort of your home.
          </p>

          <div className="hero-actions">
            <a href="#catalogue" className="button-primary">
              Explore phones <span aria-hidden="true">↗</span>
            </a>
            <a href="#benefits" className="text-link">
              Why shop with us?
            </a>
          </div>

          <div className="trust-row">
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              <span>Pay on delivery</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon">✓</span>
              <span>Free Accra delivery</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />

          <div className="hero-product-card">
            <span className="hero-card-label">
              SMART PICKS
            </span>

            <div className="hero-phone-scene">
              <div className="hero-phone hero-phone-back">
                <span className="hero-phone-camera" />
                <span className="hero-phone-camera" />
                <span className="hero-phone-camera" />
              </div>
              <div className="hero-phone hero-phone-front">
                <div className="hero-screen-time">09:41</div>
                <div className="hero-screen-art" />
              </div>
            </div>

            <div className="hero-card-footer">
              <div>
                <span>SMARTER SHOPPING</span>
                <strong>Starts right here.</strong>
              </div>
              <span className="hero-arrow">↗</span>
            </div>
          </div>

          <div className="floating-note">
            <span className="floating-note-icon">₵</span>
            <div>
              <strong>Great value</strong>
              <span>Prices you'll love</span>
            </div>
          </div>
        </div>
      </section>

      <section className="benefit-strip" id="benefits">
        <div className="benefit-item">
          <span className="benefit-number">01</span>
          <div>
            <strong>Pay on delivery</strong>
            <p>Order with confidence.</p>
          </div>
        </div>

        <div className="benefit-item">
          <span className="benefit-number">02</span>
          <div>
            <strong>Free delivery in Accra</strong>
            <p>No delivery charge within Accra.</p>
          </div>
        </div>

        <div className="benefit-item">
          <span className="benefit-number">03</span>
          <div>
            <strong>Easy ordering</strong>
            <p>Place your order online.</p>
          </div>
        </div>
      </section>
      <section className="catalogue-section" id="catalogue">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE COLLECTION</span>
            <h2>Find your next <span>favourite.</span></h2>
            <p>Explore our available smartphones and choose yours.</p>
          </div>

          <span className="product-count">
            {loading
              ? "Loading products..."
              : `${products.length} ${
                  products.length === 1 ? "product" : "products"
                } available`}
          </span>
        </div>

        {error && (
          <div className="status-message error-message" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="status-message success-message" role="status">
            {success}
          </div>
        )}

        {loading ? (
          <div className="catalogue-empty">
            <div className="loading-indicator" />
            <p>Finding something good for you...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="catalogue-empty">
            <span className="empty-icon">◇</span>
            <h3>New arrivals are on the way.</h3>
            <p>Please check back soon for available products.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((product) => {
              const isSelected =
                String(selectedProduct?.id) === String(product.id);

              return (
                <article
                  className={`product-card ${
                    isSelected ? "product-card-selected" : ""
                  }`}
                  key={product.id}
                >
                  <button
                    type="button"
                    className="product-image-button"
                    onClick={() => chooseProduct(product)}
                    aria-label={`Select ${getProductName(product)}`}
                  >
                    <span className="product-badge">AVAILABLE NOW</span>
                    <ProductArtwork product={product} />
                    <span className="product-view-arrow">↗</span>
                  </button>

                  <div className="product-card-content">
                    <span className="product-brand">
                      {product.brand || "SMARTPHONE"}
                    </span>

                    <h3>{getProductName(product)}</h3>

                    <p className="product-description">
                      {product.description ||
                        "A smartphone designed for everyday life."}
                    </p>

                    {product.specifications &&
                      typeof product.specifications === "object" && (
                        <div className="product-spec-list">
                          {Object.entries(product.specifications)
                            .slice(0, 3)
                            .map(([label, value]) => (
                              <span
                                className="product-spec"
                                key={label}
                              >
                                <span>{label}</span>
                                <strong>{String(value)}</strong>
                              </span>
                            ))}
                        </div>
                      )}

                    <div className="product-card-bottom">
                      <div className="product-price">
                        <span>Price</span>
                        <strong>{formatMoney(product.price)}</strong>
                      </div>

                      <button
                        type="button"
                        className={`product-select-button ${
                          isSelected ? "is-selected" : ""
                        }`}
                        onClick={() => {
                          chooseProduct(product);
                          document
                            .getElementById("order")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        {isSelected ? "Selected ✓" : "Choose phone"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="order-section" id="order">
        <div className="order-intro">
          <span className="eyebrow">SIMPLE. SECURE. CONVENIENT.</span>
          <h2>Your next phone is just a few details away.</h2>
          <p>
            Choose your phone, enter your delivery details and
            submit your order. We'll help you complete it through
            WhatsApp.
          </p>

          <div className="order-promises">
            <div>
              <span>✓</span>
              <p>
                <strong>Pay on delivery</strong>
                <br />
                Pay when your order arrives.
              </p>
            </div>
            <div>
              <span>✓</span>
              <p>
                <strong>Free Accra delivery</strong>
                <br />
                No delivery charge within Accra.
              </p>
            </div>
          </div>
        </div>

        <div className="order-panel">
          <div className="order-panel-heading">
            <span className="eyebrow">YOUR ORDER</span>
            <span className="secure-label">Easy checkout</span>
          </div>

          {selectedProduct ? (
            <div className="order-product-summary">
              <div className="order-product-art">
                <ProductArtwork product={selectedProduct} />
              </div>

              <div className="order-product-info">
                <span>{selectedProduct.brand || "SMARTPHONE"}</span>
                <h3>{getProductName(selectedProduct)}</h3>
                <strong>
                  {formatMoney(selectedProduct.price)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="order-no-product">
              Select an available phone above to continue.
            </div>
          )}

          <div className="quantity-row">
            <span>Quantity</span>
            <div className="quantity-control">
              <button
                type="button"
                onClick={() => changeQuantity(-1)}
                disabled={!selectedProduct || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => changeQuantity(1)}
                disabled={
                  !selectedProduct ||
                  quantity >= Math.max(
                    1,
                    Number(selectedProduct?.stock) || 1
                  )
                }
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div className="order-price-lines">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(total)}</strong>
            </div>
            <div>
              <span>Delivery within Accra</span>
              <strong className="free-delivery">FREE</strong>
            </div>
          </div>

          <div className="order-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <form className="order-form" onSubmit={submitOrder}>
            <label htmlFor="customer-name">Full name</label>
            <input
              id="customer-name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={customer.name}
              onChange={(event) =>
                updateCustomer("name", event.target.value)
              }
              required
            />

            <label htmlFor="customer-phone">Phone number</label>
            <input
              id="customer-phone"
              type="tel"
              autoComplete="tel"
              placeholder="Enter your contact number"
              value={customer.phone}
              onChange={(event) =>
                updateCustomer("phone", event.target.value)
              }
              required
            />

            <label htmlFor="delivery-address">Delivery address</label>
            <textarea
              id="delivery-address"
              autoComplete="street-address"
              placeholder="Enter your area, street or delivery location"
              rows={3}
              value={customer.address}
              onChange={(event) =>
                updateCustomer("address", event.target.value)
              }
              required
            />

            <button
              type="submit"
              className="order-submit-button"
              disabled={!selectedProduct || submitting || loading}
            >
              {submitting ? "PROCESSING ORDER..." : "ORDER NOW"}
              {!submitting && <span aria-hidden="true">↗</span>}
            </button>

            <p className="checkout-note">
              By submitting, you agree to be contacted about your order.
            </p>

            <div className="payment-note">
              <span className="payment-check">✓</span>
              <span>
                <strong>Pay on delivery</strong>
                <br />
                Your order details will be sent to WhatsApp.
              </span>
            </div>
          </form>
        </div>
      </section>      <section className="closing-banner">
        <div className="closing-banner-copy">
          <span className="eyebrow">YOUR NEXT UPGRADE AWAITS</span>
          <h2>
            Better tech.
            <br />
            <span>Better everyday.</span>
          </h2>
          <p>
            Find your next smartphone at Arthur Mall.
            Simple ordering, free delivery within Accra and
            pay-on-delivery convenience.
          </p>
          <a href="#catalogue" className="button-primary">
            Find your phone <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="closing-banner-mark" aria-hidden="true">
          A<span>.</span>
        </div>
      </section>

      <footer className="site-footer">
        <a href="#home" className="brand-lockup footer-brand">
          <span className="brand-symbol">A</span>
          <span className="brand-name">
            ARTHUR <strong>MALL</strong>
          </span>
        </a>

        <p>Good tech. Great value.</p>

        <div className="footer-links">
          <a href="#catalogue">Shop phones</a>
          <a href="#order">Order now</a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp us ↗
          </a>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Arthur Mall. All rights reserved.
          </span>
          <span>Made for smarter shopping.</span>
        </div>
      </footer>

      <a
        className="floating-whatsapp"
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
          "Hello Arthur Mall! I'd like to enquire about your available smartphones."
        )}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Contact Arthur Mall on WhatsApp"
      >
        <span className="whatsapp-icon">◉</span>
        <span>Chat with us</span>
      </a>

      {selectedProduct && (
        <div className="mobile-order-bar">
          <div className="mobile-order-price">
            <span>YOUR TOTAL</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <button
            type="button"
            onClick={scrollToOrder}
            className="mobile-order-button"
          >
            ORDER NOW <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
    </main>
  );
}
