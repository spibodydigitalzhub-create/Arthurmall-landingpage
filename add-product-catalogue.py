from pathlib import Path

page = Path("apps/web/app/page.js")
css = Path("apps/web/app/globals.css")

source = page.read_text()
styles = css.read_text()

# Check that the expected original code is still present.
checks = [
    'const [featuredProduct, setFeaturedProduct] = useState(null);',
    'const available = data.products.filter(',
    'async function orderProduct(event) {',
    '<section className="order-section" id="order">',
    'GH₵ {(price * quantity).toLocaleString()}',
]

for item in checks:
    if item not in source:
        raise SystemExit(f"STOP: Expected code not found: {item}")

if 'className="catalogue-section"' in source:
    raise SystemExit("STOP: A catalogue section already exists. No changes made.")

# Add catalogue state.
source = source.replace(
    'const [featuredProduct, setFeaturedProduct] = useState(null);',
    'const [featuredProduct, setFeaturedProduct] = useState(null);\n'
    '  const [products, setProducts] = useState([]);\n'
    '  const [selectedProduct, setSelectedProduct] = useState(null);',
    1
)

# Save every available product and retain the existing featured product.
source = source.replace(
    '        if (!cancelled && featured) {\n  setFeaturedProduct(featured);',
    '        if (!cancelled) {\n'
    '          setProducts(available);\n'
    '          if (featured) {\n'
    '            setFeaturedProduct(featured);\n'
    '            setSelectedProduct(current => current || featured);\n'
    '          }\n'
    '        }\n\n'
    '        if (!cancelled && featured) {',
    1
)

# Create separate values for the product being ordered.
source = source.replace(
    '  const productImage = featuredProduct?.image_url || "";',
    '''  const productImage = featuredProduct?.image_url || "";

  const orderProductData = selectedProduct || featuredProduct;
  const orderPrice = Number(orderProductData?.price ?? price);
  const orderProductName = orderProductData
    ? `${orderProductData.brand || ""} ${orderProductData.name}`.trim()
    : productName;
  const orderProductId = Number(orderProductData?.id ?? productId);

  function chooseProduct(product) {
    setSelectedProduct(product);
    setQuantity(1);
    document.getElementById("order")?.scrollIntoView({
      behavior: "smooth"
    });
  }''',
    1
)

# Update the existing order handler only.
start = source.index("  async function orderProduct(event) {")
end = source.index("\n  return (", start)
handler = source[start:end]

handler = handler.replace(
    "content_ids: [String(productId)]",
    "content_ids: [String(orderProductId)]"
)
handler = handler.replace(
    "content_name: productName",
    "content_name: orderProductName"
)
handler = handler.replace(
    "value: price * Number(quantity)",
    "value: orderPrice * Number(quantity)"
)
handler = handler.replace(
    "            productId,",
    "            productId: orderProductId,"
)

source = source[:start] + handler + source[end:]

# Insert the catalogue before the order form.
catalogue = '''      <section className="catalogue-section" id="catalogue">
        <div className="section-heading catalogue-heading">
          <div>
            <div className="eyebrow">
              <span></span> EXPLORE OUR COLLECTION
            </div>
            <h2>Shop all <span>products.</span></h2>
            <p className="catalogue-subtitle">
              Discover our available products and choose what you love.
            </p>
          </div>
          <span className="product-count">
            {products.length} {products.length === 1 ? "PRODUCT" : "PRODUCTS"}
          </span>
        </div>

        {products.length > 0 ? (
          <div className="catalogue-grid">
            {products.map((product) => {
              const name = `${product.brand || ""} ${product.name || ""}`.trim();

              return (
                <article className="catalogue-card" key={product.id}>
                  <div className="catalogue-image-wrap">
                    {product.image_url ? (
                      <img
                        className="catalogue-image"
                        src={product.image_url}
                        alt={name || "Product"}
                        loading="lazy"
                      />
                    ) : (
                      <div className="catalogue-no-image">
                        <span>AM</span>
                        <small>Product image coming soon</small>
                      </div>
                    )}
                    <span className="catalogue-stock">
                      In stock: {Number(product.stock)}
                    </span>
                  </div>

                  <div className="catalogue-card-body">
                    {product.category && (
                      <span className="catalogue-category">{product.category}</span>
                    )}
                    <h3>{name || "Unnamed product"}</h3>
                    <p className="catalogue-description">
                      {product.description ||
                        "Quality technology for your everyday needs."}
                    </p>
                    <div className="catalogue-card-bottom">
                      <strong>
                        GH₵ {Number(product.price).toLocaleString()}
                      </strong>
                      <button
                        type="button"
                        className="button button-dark catalogue-order-button"
                        onClick={() => chooseProduct(product)}
                      >
                        Order this product <span>↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalogue-empty">
            <h3>New products coming soon</h3>
            <p>We're preparing our collection. Please check back shortly.</p>
          </div>
        )}
      </section>

'''

marker = '      <section className="order-section" id="order">'
source = source.replace(marker, catalogue + marker, 1)

# Update the order form to show the selected product.
source = source.replace(
    '<strong>{productName}</strong>\n              <small>Featured smartphone</small>',
    '<strong>{orderProductName}</strong>\n              <small>Selected product</small>',
    1
)

source = source.replace(
    'GH₵ {price.toLocaleString()}\n            </strong>\n          </div>\n\n          <label htmlFor="customer-name">',
    'GH₵ {orderPrice.toLocaleString()}\n            </strong>\n          </div>\n\n          <label htmlFor="customer-name">',
    1
)

source = source.replace(
    'GH₵ {(price * quantity).toLocaleString()}',
    'GH₵ {(orderPrice * quantity).toLocaleString()}',
    1
)

# Keep the catalogue styles separate from existing styles.
catalogue_css = r"""

/* All-products catalogue */
.catalogue-section {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: 72px 0;
  scroll-margin-top: 90px;
}

.catalogue-heading {
  margin-bottom: 28px;
  gap: 20px;
}

.catalogue-subtitle {
  margin-top: 12px;
  max-width: 540px;
  line-height: 1.7;
  color: #777;
}

.catalogue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 235px), 1fr));
  gap: 22px;
}

.catalogue-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, .09);
  border-radius: 18px;
  background: #fff;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.catalogue-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 35px rgba(0, 0, 0, .08);
}

.catalogue-image-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  overflow: hidden;
  padding: 18px;
  background: #f5f6f2;
}

.catalogue-image {
  display: block;
  width: 100%;
  height: 220px;
  object-fit: contain;
}

.catalogue-stock {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 6px 9px;
  border-radius: 30px;
  background: #e6f5df;
  color: #246b24;
  font-size: 11px;
  font-weight: 700;
}

.catalogue-no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #666;
  text-align: center;
}

.catalogue-no-image span {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  border-radius: 18px;
  background: #c8f31e;
  color: #111;
  font-size: 24px;
  font-weight: 900;
}

.catalogue-no-image small {
  font-size: 12px;
}

.catalogue-card-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 19px;
}

.catalogue-category {
  margin-bottom: 8px;
  color: #568000;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.catalogue-card-body h3 {
  margin: 0;
  color: #151515;
  font-size: 19px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.catalogue-description {
  display: -webkit-box;
  min-height: 60px;
  margin: 10px 0 18px;
  overflow: hidden;
  color: #686868;
  font-size: 13px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.catalogue-card-bottom {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 15px;
  margin-top: auto;
}

.catalogue-card-bottom > strong {
  color: #111;
  font-size: 23px;
}

.catalogue-order-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 46px;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.catalogue-empty {
  padding: 40px 20px;
  border: 1px dashed #ccc;
  border-radius: 18px;
  text-align: center;
}

.catalogue-empty p {
  color: #777;
}

@media (max-width: 600px) {
  .catalogue-section {
    width: calc(100% - 28px);
    padding: 48px 0;
  }

  .catalogue-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .catalogue-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .catalogue-image-wrap {
    min-height: 150px;
    padding: 10px;
  }

  .catalogue-image {
    height: 150px;
  }

  .catalogue-stock {
    left: 7px;
    top: 7px;
    padding: 5px 7px;
    font-size: 9px;
  }

  .catalogue-card-body {
    padding: 12px;
  }

  .catalogue-card-body h3 {
    font-size: 15px;
  }

  .catalogue-description {
    min-height: 58px;
    font-size: 12px;
  }

  .catalogue-card-bottom > strong {
    font-size: 17px;
  }

  .catalogue-order-button {
    padding: 9px 5px;
    font-size: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .catalogue-card {
    transition: none;
  }

  .catalogue-card:hover {
    transform: none;
  }
}
"""

if "/* All-products catalogue */" not in styles:
    styles += "\n" + catalogue_css

# Only write after all checks and transformations have completed.
page.write_text(source)
css.write_text(styles)

print("SUCCESS: Catalogue added.")
print("SUCCESS: Product selection wired into ordering.")
print("SUCCESS: Existing order handler preserved.")
