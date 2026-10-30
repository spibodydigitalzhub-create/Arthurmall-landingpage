from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

path = Path("apps/api/src/server.js")
source = path.read_text()

def patch(old, new, expected, label):
    global source
    count = source.count(old)
    if count != expected:
        sys.exit(f"STOP: {label}: expected {expected}, found {count}. No changes saved.")
    source = source.replace(old, new)

# Public and admin product queries
patch(
    "price, category, image_url, stock, active, created_at",
    "price, category, image_url, images, stock, active, created_at",
    2, "Product queries"
)

# Product creation
patch(
    '    const imageUrl = b.image_url === undefined ? "" : b.image_url;\n',
    '''    const imageUrl = b.image_url === undefined ? "" : b.image_url;
    const images = b.images === undefined
      ? (imageUrl ? [imageUrl] : [])
      : b.images;

    if (
      !Array.isArray(images) || images.length > 4 ||
      images.some(url => typeof url !== "string" ||
        url.length > 2000 || !/^https:\\/\\/.+/i.test(url))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide up to four valid HTTPS image URLs."
      });
    }

    const gallery = images;
    const mainImage = gallery[0] || imageUrl;
''',
    1, "POST image handling"
)

patch(
    "category, image_url, stock, active)\n      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)",
    "category, image_url, images, stock, active)\n      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)",
    1, "POST SQL"
)

patch(
    "      imageUrl.trim(),\n      stock\n",
    "      mainImage.trim(),\n      JSON.stringify(gallery),\n      stock\n",
    1, "POST values"
)

# Product editing
patch(
    '    const imageUrl = b.image_url === undefined ? current.image_url : b.image_url;\n',
    '''    const imageUrl = b.image_url === undefined ? current.image_url : b.image_url;
    const currentImages = Array.isArray(current.images)
      ? current.images
      : (current.image_url ? [current.image_url] : []);

    const images = b.images === undefined ? currentImages : b.images;

    if (
      !Array.isArray(images) || images.length > 4 ||
      images.some(url => typeof url !== "string" ||
        url.length > 2000 || !/^https:\\/\\/.+/i.test(url))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide up to four valid HTTPS image URLs."
      });
    }

    const gallery = images;
    const mainImage = gallery[0] || imageUrl;
''',
    1, "PUT image handling"
)

patch(
    '      typeof imageUrl !== "string" || imageUrl.length > 2000 ||\n',
    '      typeof mainImage !== "string" || mainImage.length > 2000 ||\n',
    2, "Image validations"
)

patch(
    "image_url = $8, stock = $9\n      WHERE id = $10",
    "image_url = $8, images = $9::jsonb, stock = $10\n      WHERE id = $11",
    1, "PUT SQL"
)

patch(
    "      imageUrl.trim(),\n      stock,\n      id\n",
    "      mainImage.trim(),\n      JSON.stringify(gallery),\n      stock,\n      id\n",
    1, "PUT values"
)

# Syntax-check before changing the original file.
check = Path("apps/api/src/server.gallery-check.js")
check.write_text(source)

result = subprocess.run(
    ["node", "--check", str(check)],
    capture_output=True, text=True
)

check.unlink(missing_ok=True)

if result.returncode:
    print(result.stderr)
    sys.exit("STOP: Syntax check failed. Original file unchanged.")

backup = path.with_name(
    path.name + ".before-gallery-" +
    datetime.now().strftime("%Y%m%d-%H%M%S")
)

shutil.copy2(path, backup)
path.write_text(source)

print("SUCCESS: Gallery API updated.")
print("Backup:", backup)
print("JavaScript syntax: OK")
