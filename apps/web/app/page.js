"use client";

import { useEffect, useState } from "react";
function trackMetaEvent(eventName, parameters = {}) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, parameters);
  }
}
const WHATSAPP_NUMBER = "233570848484";
const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

export default function Home() {
  const [quantity, setQuantity] = useState(1);
  const [featuredProduct, setFeaturedProduct] = useState(null);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch(`${API}/api/products`);
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.products)) {
          throw new Error("Could not load products");
        }

        const available = data.products.filter(
          product => Number(product.active) === 1 &&
                     Number(product.stock) > 0
        );

        const featured =
          available.find(product => product.image_url) ||
          available[0];

        if (!cancelled && featured) {
  setFeaturedProduct(featured);

  if (typeof window !== "undefined" &&
      typeof window.fbq === "function") {
    window.fbq("track", "ViewContent", {
      content_ids: [String(featured.id)],
      content_name: `${featured.brand || ""} ${featured.name}`.trim(),
      content_type: "product",
      value: Number(featured.price),
      currency: "GHS"
    });
  }
}
     } catch (error) {
        console.error("Product loading failed:", error);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(
      ".benefit-strip, .product-card, .order-intro, .order-form, .closing-banner"
    );

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("scroll-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("scroll-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const price = Number(featuredProduct?.price ?? 1550);
  const productName = featuredProduct
    ? `${featuredProduct.brand || ""} ${featuredProduct.name}`.trim()
    : "Xiaomi Redmi 14C";
  const productId = Number(featuredProduct?.id ?? 1);
  const productImage = featuredProduct?.image_url || "";

  async function orderProduct(event) {
    event.preventDefault();
trackMetaEvent("InitiateCheckout", {
  content_ids: [String(productId)],
  content_name: productName,
  content_type: "product",
  value: price * Number(quantity),
  currency: "GHS",
  num_items: Number(quantity)
});
    const submitButton = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Processing order...";
    }

    try {
      const response = await fetch(
        `${API}/api/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName: customer.name,
            customerPhone: customer.phone,
            deliveryAddress: customer.address,
            productId,
            quantity: Number(quantity),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to save your order."
        );
      }

      const order = result.order;
trackMetaEvent("Purchase", {
  content_ids: [String(productId)],
  content_name: productName,
  content_type: "product",
  value: Number(order.totalPrice),
  currency: "GHS",
  num_items: Number(order.quantity)
});
      const message = [
        "Hello Arthur's Mall! I'd like to confirm my order.",
        "",
        "Order ID: " + order.id,
        "Product: " + order.product,
        "Quantity: " + order.quantity,
        "Unit price: GH₵ " + order.unitPrice.toLocaleString(),
        "Total: GH₵ " + order.totalPrice.toLocaleString(),
        "",
        "Customer name: " + customer.name,
        "Phone: " + customer.phone,
        "Delivery address: " + customer.address,
        "",
        "Payment: Pay on delivery",
        "Please confirm my order.",
      ].join("\\n");

      const url =
        "https://wa.me/" +
        WHATSAPP_NUMBER +
        "?text=" +
        encodeURIComponent(message);

      window.location.href = url;
    } catch (error) {
      alert(
        error.message ||
          "Unable to submit your order. Please try again."
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Order on WhatsApp";
      }
    }
  }

  return (
    <main>
      <div className="announcement">
        <span className="announcement-dot"></span>
        FREE DELIVERY WITHIN ACCRA · PAY ON DELIVERY
      </div>

      <header className="navbar">
         <a className="brand" href="#">
           <span className="brand-mark">A</span>
          <span>
            ARTHUR'S
            <small>MALL</small>
          </span>
        </a>

        <nav>
          <a href="#product">Shop</a>
          <a href="#benefits">Why us</a>
          <a href="#order">Order</a>
        </nav>

        <a
          className="nav-cta"
          href="#order"
        >
          Shop now <span>↗</span>
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span></span> SMART SHOPPING STARTS HERE
          </div>

          <h1>
            Better tech.
            <br />
            <span>Better living.</span>
          </h1>

          <p className="hero-description">
            Discover quality technology at prices that make sense.
            Shop confidently with Arthur's Mall.
          </p>

          <div className="hero-actions">
            <a href="#product" className="button button-green">
              Explore product <span>↗</span>
            </a>

            <a href="#benefits" className="text-link">
              Why Arthur's Mall? <span>↓</span>
            </a>
          </div>

          <div className="trust-row">
            <div className="trust-icon">✓</div>
            <div>
              <strong>Pay when it arrives</strong>
              <small>Payment on delivery available</small>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-label">FEATURED PRODUCT · 001</div>

          <div className="product-stage">
            <div className="stage-glow"></div>

            {productImage ? (
              <img
                className="hero-product-photo"
                src={productImage}
                alt={productName}
                style={{
                  display: "block",
                  width: "min(100%, 340px)",
                  maxHeight: "380px",
                  objectFit: "contain",
                  borderRadius: "18px",
                  margin: "0 auto",
                }}
              />
            ) : (
            <div className="phone">
              <div className="phone-camera">
                <div className="camera-lens"></div>
                <div className="camera-lens"></div>
                <div className="camera-flash"></div>
              </div>
              <div className="phone-brand">Redmi</div>
              <div className="phone-screen">
                <div className="screen-orb orb-one"></div>
                <div className="screen-orb orb-two"></div>
                <div className="screen-orb orb-three"></div>
                <div className="screen-label">REDMI</div>
              </div>
            </div>
            )}

            <div className="floating-card">
              <span className="floating-label">YOUR NEXT UPGRADE</span>
              <strong>{featuredProduct?.name || "Redmi 14C"}</strong>
              <div className="floating-bottom">
                <span>GH₵ {price.toLocaleString()}</span>
                <span className="green-check">✓</span>
              </div>
            </div>

            <div className="floating-tag">
              <span>✳</span> Great value
            </div>
          </div>

          <div className="visual-footer">
            <span>{productName.toUpperCase()}</span>
            <span>AVAILABLE NOW ↗</span>
          </div>
        </div>
      </section>

      <div className="benefit-strip" id="benefits">
        <div>
          <span className="benefit-symbol">↗</span>
          <div>
            <strong>Free Accra delivery</strong>
            <small>No delivery fee within Accra</small>
          </div>
        </div>

        <div>
          <span className="benefit-symbol">₵</span>
          <div>
            <strong>Pay on delivery</strong>
            <small>Pay when your order arrives</small>
          </div>
        </div>

        <div>
          <span className="benefit-symbol">◎</span>
          <div>
            <strong>Direct ordering</strong>
            <small>Order conveniently on WhatsApp</small>
          </div>
        </div>
      </div>

      <section className="product-section" id="product">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span></span> HANDPICKED FOR YOU
            </div>
            <h2>Featured <span>product.</span></h2>
          </div>

          <span className="product-count">01 / CURRENT COLLECTION</span>
        </div>

        <article className="product-card">
          <div className="product-art">
            <div className="product-badge">FEATURED</div>
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  minHeight: "280px",
                  maxHeight: "440px",
                  objectFit: "contain",
                  padding: "20px",
                }}
              />
            ) : (
            <div className="product-phone">
              <div className="product-camera">
                <i></i>
                <i></i>
                <i></i>
              </div>
              <div className="product-screen-orb"></div>
              <span className="product-logo">Redmi</span>
            </div>
            )}
            <div className="art-caption">{productName.toUpperCase()}</div>
          </div>

          <div className="product-info">
            <div className="stock-status">
              <span></span> FEATURED ITEM
            </div>

            <h3>{productName}</h3>

            <p className="product-description">
              {featuredProduct?.description ||
                "A stylish smartphone for your everyday digital life."}
            </p>

            <div className="product-price">
              <strong>GH₵ {price.toLocaleString()}</strong>
              <span>Ghana cedis</span>
            </div>

            <div className="product-divider"></div>

            <div className="spec-list">
              <div><span>01</span> Modern smartphone design</div>
              <div><span>02</span> Everyday communication and apps</div>
              <div><span>03</span> Free delivery within Accra</div>
            </div>

            <a href="#order" className="button button-dark product-button">
              Order this phone <span>↗</span>
            </a>

            <p className="payment-note">
              ✓ Pay on delivery · Order through WhatsApp
            </p>
          </div>
        </article>
      </section>

      <section className="order-section" id="order">
        <div className="order-intro">
          <div className="eyebrow">
            <span></span> READY TO ORDER?
          </div>

          <h2>
            Your next phone
            <br />
            <span>is one step away.</span>
          </h2>

          <p>
            Fill in your details. We'll prepare your order
            in WhatsApp so you can send it directly to us.
          </p>

          <div className="order-assurance">
            <span>✓</span>
            <div>
              <strong>No online payment required</strong>
              <small>Pay on delivery. Free delivery within Accra.</small>
            </div>
          </div>
        </div>

        <form className="order-form" onSubmit={orderProduct}>
          <div className="form-top">
            <div>
              <span className="form-step">ORDER FORM / 01</span>
              <h3>Place your order</h3>
            </div>
            <span className="form-icon">↗</span>
          </div>

          <div className="selected-product">
            <div className="mini-phone">A</div>
            <div className="selected-details">
              <strong>{productName}</strong>
              <small>Featured smartphone</small>
            </div>
            <strong className="selected-price">
              GH₵ {price.toLocaleString()}
            </strong>
          </div>

          <label htmlFor="customer-name">Full name</label>
          <input
            id="customer-name"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            value={customer.name}
            onChange={(e) =>
              setCustomer({ ...customer, name: e.target.value })
            }
            required
          />

          <label htmlFor="customer-phone">Phone number</label>
          <input
            id="customer-phone"
            type="tel"
            placeholder="e.g. 024 123 4567"
            autoComplete="tel"
            value={customer.phone}
            onChange={(e) =>
              setCustomer({ ...customer, phone: e.target.value })
            }
            required
          />

          <label htmlFor="customer-address">Delivery address</label>
          <textarea
            id="customer-address"
            placeholder="Enter your area and delivery location"
            autoComplete="street-address"
            rows="3"
            value={customer.address}
            onChange={(e) =>
              setCustomer({ ...customer, address: e.target.value })
            }
            required
          />

          <div className="quantity-row">
            <span>Quantity</span>
            <div className="quantity-control">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <strong>{quantity}</strong>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="total-row">
            <span>Order total</span>
            <strong>GH₵ {(price * quantity).toLocaleString()}</strong>
          </div>

          <button type="submit" className="button button-green submit-button">
            Continue to WhatsApp <span>↗</span>
          </button>

          <p className="form-footnote">
            Your order details will be opened in WhatsApp for you to send.
          </p>
        </form>
      </section>

      <section className="closing-banner">
        <div>
          <span className="closing-kicker">ARTHUR'S MALL · SMARTER SHOPPING</span>
          <h2>Good choices.<br />Better experiences.</h2>
        </div>
        <a href="#order" className="button button-light">
          Get your Redmi 14C <span>↗</span>
        </a>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">A</span>
          <span>
            ARTHUR'S
            <small>MALL</small>
          </span>
        </a>

        <p>Quality tech. Convenient shopping.</p>

        <a
          className="footer-contact"
          href={"https://wa.me/" + WHATSAPP_NUMBER}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackMetaEvent("Contact", {
            content_name: "Arthur's Mall WhatsApp",
            content_category: "Customer Support"
          })}
        >
          Contact us on WhatsApp ↗
        </a>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Arthur's Mall</span>
          <span>Made for smarter shopping.</span>
        </div>
      </footer>

      <a
        className="whatsapp-float"
        href={"https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent("Hello Arthur's Mall! I'd like to make an enquiry about your products.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Arthur's Mall on WhatsApp"
        onClick={() => trackMetaEvent("Contact", {
          content_name: "Arthur's Mall WhatsApp",
          content_category: "Customer Support"
        })}
      >
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M16 .8A15.1 15.1 0 0 0 3.1 23.8L1 31l7.4-2A15.1 15.1 0 1 0 16 .8Zm0 27.5a12.4 12.4 0 0 1-6.3-1.7l-.5-.3-4.4 1.2 1.2-4.3-.3-.5A12.4 12.4 0 1 1 16 28.3Zm6.8-9.3c-.4-.2-2.1-1-2.5-1.1-.3-.1-.6-.2-.8.2s-.9 1.1-1.1 1.3c-.2.2-.4.2-.8.1-.4-.2-1.5-.6-2.9-1.8-1.1-1-1.8-2.2-2-2.5-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.4-.6.1-.2 0-.4 0-.6-.1-.2-.8-2-1.1-2.7-.3-.7-.6-.6-.8-.6h-.7c-.3 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.6.8.2 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.1-.3-.2-.7-.4Z"
          />
        </svg>
        <span className="whatsapp-float-label">Chat with us</span>
      </a>

      <a
        className="mobile-order"
        href="#order"
      >
        Order Redmi 14C · GH₵ 1,550 <span>↗</span>
      </a>
    </main>
  );
}
