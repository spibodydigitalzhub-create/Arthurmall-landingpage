from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

path = Path("apps/web/app/admin/page.js")
source = path.read_text()

def patch(old, new, count, label):
    global source
    found = source.count(old)
    if found != count:
        sys.exit(
            f"STOP: {label}: expected {count} matches, found {found}. "
            "Original file unchanged."
        )
    source = source.replace(old, new)

# Add gallery state to new products.
patch(
    '  image_url: "",\n  description: "",',
    '  image_url: "",\n  images: [],\n  description: "",',
    1,
    "Empty product gallery state"
)

# Load existing gallery when editing a product.
patch(
    '      image_url: product.image_url || "",\n      description: product.description || "",',
    '''      image_url: product.image_url || "",
      images: Array.isArray(product.images)
        ? product.images.slice(0, 4)
        : (product.image_url ? [product.image_url] : []),
      description: product.description || "",''',
    1,
    "Edit product gallery state"
)

# Replace the existing single-image uploader function.
start = source.find("  async function uploadImage(event) {")
end = source.find("\n  async function saveProduct(event) {", start)

if start < 0 or end < 0:
    sys.exit("STOP: Could not locate uploadImage function. Nothing saved.")

new_upload = r'''  async function uploadImage(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;

    const existing = productForm.images || [];
    const remaining = 4 - existing.length;

    if (remaining <= 0) {
      setError("A product can have a maximum of four images.");
      return;
    }

    if (files.length > remaining) {
      setError(`You can select only ${remaining} more image(s).`);
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

    setUploading(true);
    setError("");
    setNotice("");

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

      setProductForm((current) => {
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

      setNotice(`${uploaded.length} product image(s) uploaded successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
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
'''

source = source[:start] + new_upload + source[end:]

# Include gallery images in the API payload.
patch(
    '      image_url: productForm.image_url.trim(),\n      description: productForm.description.trim(),',
    '''      image_url: (productForm.images?.[0] || productForm.image_url || "").trim(),
      images: (productForm.images || []).slice(0, 4),
      description: productForm.description.trim(),''',
    1,
    "Save product gallery payload"
)

# Replace the old single-image uploader UI.
old_ui = '''              <div className="am-image-uploader">
                <span className="am-field-title">Product image</span>

                <div className="am-image-preview">
                  {productForm.image_url ? (
                    <img
                      src={productForm.image_url}
                      alt="Product preview"
                    />
                  ) : (
                    <div>
                      <span>＋</span>
                      <small>Image preview</small>
                    </div>
                  )}
                </div>

                <label className="am-upload-button">
                  {uploading ? "Uploading image..." : "↑ Choose image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={uploadImage}
                    disabled={uploading || saving}
                  />
                </label>

                <small>JPG, PNG or WEBP · Maximum 5MB</small>

                <label className="am-url-label">
                  Or paste an image URL
                  <input
                    type="url"
                    maxLength={2000}
                    value={productForm.image_url}
                    onChange={(e) =>
                      updateProductField("image_url", e.target.value)
                    }
                    placeholder="https://example.com/image.jpg"
                  />
                </label>
              </div>'''

new_ui = '''              <div className="am-image-uploader">
                <span className="am-field-title">
                  Product gallery ({(productForm.images || []).length}/4)
                </span>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                  marginTop: "12px"
                }}>
                  {(productForm.images || []).map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      style={{
                        position: "relative",
                        minWidth: 0,
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: "#f1f3ed",
                        aspectRatio: "1 / 1"
                      }}
                    >
                      <img
                        src={url}
                        alt={`Product image ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain"
                        }}
                      />

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
                        {index === 0 ? "Main image" : `Image ${index + 1}`}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeProductImage(index)}
                        disabled={uploading || saving}
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

                  {(productForm.images || []).length === 0 && (
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
                  Select up to four JPG, PNG or WEBP images.
                  Maximum 5MB per image.
                </small>
              </div>'''

patch(old_ui, new_ui, 1, "Product gallery interface")

# Save a backup, apply the patch, then validate with Next.js.
backup = path.with_name(
    path.name + ".before-gallery-" +
    datetime.now().strftime("%Y%m%d-%H%M%S")
)

shutil.copy2(path, backup)
path.write_text(source)

print("Admin gallery patch applied. Running Next.js build...")

result = subprocess.run(
    ["npm", "run", "build", "--workspace=@arthurs-mall/web"]
)

if result.returncode:
    shutil.copy2(backup, path)
    sys.exit(
        "BUILD FAILED: Original admin page restored. "
        f"Backup retained at {backup}"
    )

print("SUCCESS: Admin gallery updated.")
print("Backup:", backup)
print("Next.js production build: OK")
