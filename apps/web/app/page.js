
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const images = (
    Array.isArray(product?.images) && product.images.length
      ? product.images
      : product?.image_url
        ? [product.image_url]
        : []
  )
    .filter(url => typeof url === "string" && url.trim())
    .slice(0, 4);

  const [activeImage, setActiveImage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState(0);
  const touchStartX = useRef(null);
  const viewerTouchStartX = useRef(null);

  useEffect(() => {
    setActiveImage(0);
    setViewerOpen(false);
    setViewerImage(0);
  }, [product?.id]);

  useEffect(() => {
    if (!viewerOpen) return;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event) {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowRight") {
        setViewerImage(current => (current + 1) % images.length);
      }
      if (event.key === "ArrowLeft") {
        setViewerImage(current => (current - 1 + images.length) % images.length);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [viewerOpen, images.length]);

  function swipeStart(event, ref) {
    if (event.touches.length === 1) {
      ref.current = event.touches[0].clientX;
    }
  }

  function swipeEnd(event, ref, setter) {
    if (ref.current === null) return;
    const distance = event.changedTouches[0].clientX - ref.current;
    ref.current = null;

    if (Math.abs(distance) < 45 || images.length < 2) return;

    setter(current => distance < 0
      ? (current + 1) % images.length
      : (current - 1 + images.length) % images.length
    );
  }

  if (images.length > 0) {
    const safeIndex = Math.min(activeImage, images.length - 1);
    const safeViewerIndex = Math.min(viewerImage, images.length - 1);

    return (
      <>
        <div
          className="product-gallery"
          onTouchStart={event => swipeStart(event, touchStartX)}
          onTouchEnd={event => swipeEnd(event, touchStartX, setActiveImage)}
          onTouchCancel={() => { touchStartX.current = null; }}
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            touchAction: "pan-y"
          }}
        >
          <button
            type="button"
            onClick={() => {
              setViewerImage(safeIndex);
              setViewerOpen(true);
            }}
            aria-label={`Enlarge ${getProductName(product)} image`}
            style={{
              width: "100%",
              height: "100%",
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "zoom-in"
            }}
          >
            <img
              src={images[safeIndex]}
              alt={`${getProductName(product)} - image ${safeIndex + 1}`}
              className="product-artwork-image"
              draggable="false"
            />
          </button>

          {images.length > 1 && (
            <div
              aria-label={`Image ${safeIndex + 1} of ${images.length}`}
              style={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 7,
                padding: "6px 10px",
                borderRadius: 20,
                background: "rgba(0,0,0,.48)",
                pointerEvents: "none"
              }}
            >
              {images.map((_, index) => (
                <span
                  key={index}
                  style={{
                    display: "block",
                    width: index === safeIndex ? 17 : 7,
                    height: 7,
                    borderRadius: 10,
                    background: index === safeIndex ? "#c8f31e" : "#fff"
                  }}
                />
              ))}
            </div>
          )}

          <span style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            fontSize: 10,
            color: "#fff",
            background: "rgba(0,0,0,.48)",
            borderRadius: 12,
            padding: "5px 8px",
            pointerEvents: "none"
          }}>
            Tap to enlarge
          </span>
        </div>

        {viewerOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${getProductName(product)} image viewer`}
            onClick={() => setViewerOpen(false)}
            onTouchStart={event => swipeStart(event, viewerTouchStartX)}
            onTouchEnd={event => swipeEnd(event, viewerTouchStartX, setViewerImage)}
            onTouchCancel={() => { viewerTouchStartX.current = null; }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(0,0,0,.96)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "65px 16px 70px",
              touchAction: "pan-y"
            }}
          >
            <button
              type="button"
              aria-label="Close image viewer"
              onClick={() => setViewerOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                width: 46,
                height: 46,
                border: "1px solid #777",
                borderRadius: "50%",
                background: "#222",
                color: "#fff",
                fontSize: 28
              }}
            >×</button>

            <span style={{
              position: "absolute",
              top: 30,
              left: "50%",
              transform: "translateX(-50%)",
              color: "#fff"
            }}>
              {safeViewerIndex + 1} / {images.length}
            </span>

            {images.length > 1 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={event => {
                  event.stopPropagation();
                  setViewerImage((safeViewerIndex - 1 + images.length) % images.length);
                }}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  width: 44,
                  height: 44,
                  border: 0,
                  borderRadius: "50%",
                  background: "#333",
                  color: "#fff",
                  fontSize: 28
                }}
              >‹</button>
            )}

            <img
              src={images[safeViewerIndex]}
              alt={`${getProductName(product)} - image ${safeViewerIndex + 1}`}
              onClick={event => event.stopPropagation()}
              draggable="false"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                userSelect: "none"
              }}
            />

            {images.length > 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={event => {
                  event.stopPropagation();
                  setViewerImage((safeViewerIndex + 1) % images.length);
                }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  width: 44,
                  height: 44,
                  border: 0,
                  borderRadius: "50%",
                  background: "#333",
                  color: "#fff",
                  fontSize: 28
                }}
              >›</button>
            )}

            <span style={{
              position: "absolute",
              bottom: 20,
              color: "#ddd",
              fontSize: 12
            }}>
              Swipe or use arrows to view more
            </span>
          </div>
        )}
      </>
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

      trackMetaEvent("Lead", {
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

      <section className="hero-section store-hero" id="home">
        <div className="store-hero-content">
          <span className="eyebrow">WELCOME TO ARTHUR'S MALL</span>

          <h1>
            Smart choices.
            <br />
            <span>Better shopping.</span>
          </h1>

          <p>
            Discover smartphones that match your lifestyle.
            Quality products, great value and a shopping experience
            designed around you.
          </p>

          <div className="hero-trust-badges">
            <span>✓ Free delivery within Accra</span>
            <span>✓ Pay on delivery</span>
          </div>

          <div className="hero-actions">
            <a href="#catalogue" className="hero-primary-btn">
              Explore phones <span>↗</span>
            </a>
            <a href="#welcome" className="hero-secondary-btn">
              Discover Arthur's Mall
            </a>
          </div>
        </div>

        <div className="store-hero-visual">
          <img
            src="https://mediaserver.responsesource.com/press-release/149441/Buyerinstore.jpg"
            alt="Customer shopping in a phone store"
            className="store-hero-image"
          />

          <div className="hero-floating-note">
            <span>✓</span>
            Shop with confidence
          </div>
        </div>
      </section>

      <section className="welcome-section" id="welcome">
        <div className="welcome-label">A BETTER WAY TO SHOP</div>
        <h2>Welcome to <span>Arthur's Mall.</span></h2>
        <p>
          Your destination for smartphones and everyday technology.
          We make shopping simple with carefully selected products,
          competitive prices and convenient delivery.
        </p>
      </section>

      <section className="quick-order-section" id="how-to-order">
        <div className="quick-order-heading">
          <span className="eyebrow">THREE SIMPLE STEPS</span>
          <h2>How to <span>order.</span></h2>
        </div>

        <div className="quick-order-grid">
          <article className="quick-order-card">
            <span>01</span>
            <div>
              <h3>Choose your phone</h3>
              <p>Explore our collection and select your preferred product.</p>
            </div>
          </article>

          <article className="quick-order-card">
            <span>02</span>
            <div>
              <h3>Submit your details</h3>
              <p>Complete the order form with your contact and delivery details.</p>
            </div>
          </article>

          <article className="quick-order-card">
            <span>03</span>
            <div>
              <h3>Receive your order</h3>
              <p>We will contact you to confirm your order and delivery.</p>
            </div>
          </article>
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
