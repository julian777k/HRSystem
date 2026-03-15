#!/bin/bash
# Upload all screenshots from public/screenshots/ to R2 bucket hr-saas-files
# Run from the hr/ directory: bash scripts/upload-screenshots-r2.sh

set -e

BUCKET="hr-saas-files"
SRC_DIR="public/screenshots"

if [ ! -d "$SRC_DIR" ]; then
  echo "Error: $SRC_DIR directory not found. Run this script from the hr/ directory."
  exit 1
fi

echo "Uploading screenshots to R2 bucket: $BUCKET"
echo "---"

for file in "$SRC_DIR"/*.png; do
  filename=$(basename "$file")
  key="screenshots/$filename"
  echo "Uploading: $key"
  npx wrangler r2 object put "$BUCKET/$key" --file="$file" --content-type="image/png" --remote
done

echo "---"
echo "Done! All screenshots uploaded to R2."
echo ""
echo "Verify with:"
echo "  npx wrangler r2 object list hr-saas-files --prefix=screenshots/"
