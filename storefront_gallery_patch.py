from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

path = Path("apps/web/app/page.js")
source = path.read_text()

old_import = 'import { useEffect, useMemo, useState } from "react";'

new_import = 'import { useEffect, useMemo, useRef, useState } from "react";'

if source.count(old_import) != 1:
    sys.exit("STOP: Could not safely locate React imports. No changes made.")

source = source.replace(old_import, new_import)

start = source.find("function ProductArtwork({ product }) {")
end = source.find("\nexport default function Home()", start)

if start < 0 or end < 0:
    sys.exit("STOP: Could not locate ProductArtwork component. No changes made.")

new_component = r'''function ProductArtwork({ product }) {
  const images = (
    Array.isArray(product?.images) && product.images.length
      ? product.images
      : product?.image_url
        ? [product.image_url]
        : []
  )
    .filter((url) => typeof url === "string" && url.trim())
    .slice(0, 4);

  const [activeImage, setActiveImage] = useState(0);
  const touchStartX = useRef(null);

  useEffect(() => {
    setActiveImage(0);
  }, [product?.id]);

  function handleTouchStart(event) {
    if (event.touches.length === 1) {
      touchStartX.current = event.touches[0].clientX;
    }
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;

    const endX = event.changedTouches[0]?.clientX;
    const distance = endX - touchStartX.current;

    touchStartX.current = null;

    if (Math.abs(distance) < 45 || images.length < 2) return;

    setActiveImage((current) => {
      if (distance < 0) {
        return (current + 1) % images.length;
      }

      return (current - 1 + images.length) % images.length;
    });
  }

  if (images.length > 0) {
    const safeIndex = Math.min(activeImage, images.length - 1);

    return (
      <div
        className="product-gallery"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null;
        }}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "pan-y",
        }}
      >
        <img
          src={images[safeIndex]}
          alt={`${getProductName(product)} - image ${safeIndex + 1}`}
          className="product-artwork-image"
          draggable="false"
        />

        {images.length > 1 && (
          <div
            aria-label={`Image ${safeIndex + 1} of ${images.length}`}
            style={{
              position: "absolute",
              bottom: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              padding: "6px 10px",
              borderRadius: "20px",
              background: "rgba(0,0,0,0.48)",
            }}
          >
            {images.map((_, index) => (
              <span
                key={index}
                style={{
                  display: "block",
                  width: index === safeIndex ? "17px" : "7px",
                  height: "7px",
                  borderRadius: "10px",
                  background: index === safeIndex ? "#c8f31e" : "#ffffff",
                  transition: "width 180ms ease",
                }}
              />
            ))}
          </div>
        )}

        {images.length > 1 && (
          <span
            style={{
              position: "absolute",
              right: "10px",
              bottom: "10px",
              fontSize: "10px",
              color: "#fff",
              background: "rgba(0,0,0,0.48)",
              borderRadius: "12px",
              padding: "5px 8px",
            }}
          >
            Swipe to view
          </span>
        )}
      </div>
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
'''

source = source[:start] + new_component + source[end:]

# Validate that the existing product card still uses ProductArtwork.
if source.count("<ProductArtwork product={product} />") != 1:
    sys.exit("STOP: Product card integration check failed. No changes made.")

backup = path.with_name(
    path.name + ".before-swipe-gallery-" +
    datetime.now().strftime("%Y%m%d-%H%M%S")
)

shutil.copy2(path, backup)
path.write_text(source)

print("Swipe gallery patch applied. Running Next.js build...")

result = subprocess.run(
    ["npm", "run", "build", "--workspace=@arthurs-mall/web"]
)

if result.returncode:
    shutil.copy2(backup, path)
    sys.exit(
        f"BUILD FAILED: Original storefront restored. Backup: {backup}"
    )

print("SUCCESS: Customer swipe gallery installed.")
print("Backup:", backup)
print("Next.js production build: OK")
