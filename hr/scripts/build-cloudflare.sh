#!/bin/bash
# Cloudflare Workers build script
# Usage: ./scripts/build-cloudflare.sh [--upload-wasm]
#
# --upload-wasm: Upload WASM to R2 (needed on first deploy or after Prisma version change)

set -e

echo "=== Cloudflare Workers Build ==="
echo ""

# Set environment for Cloudflare build
export DEPLOY_TARGET=cloudflare
export DB_PROVIDER=sqlite
export NEXT_PUBLIC_DB_PROVIDER=sqlite
export NEXT_PUBLIC_DEPLOY_TARGET=cloudflare

# Generate Prisma client
echo "[1/5] Generating Prisma client..."
npx prisma generate --schema=prisma/schema.sqlite.prisma

# Build with OpenNext Cloudflare adapter
echo "[2/5] Building with OpenNext..."
npx opennextjs-cloudflare build

# ─── Step 3: Stub unused middleware WASM ───
echo "[3/5] Stubbing middleware WASM..."

BEFORE_SIZE=$(du -sk .open-next/ | cut -f1)

# Middleware only uses jose/JWT — Prisma WASM is never loaded at runtime
for wasm in .open-next/middleware/wasm/*.wasm; do
  if [ -f "$wasm" ]; then
    SIZE_KB=$(du -k "$wasm" | cut -f1)
    if [ "$SIZE_KB" -gt 100 ]; then
      echo "  - Stubbing $(basename "$wasm") (${SIZE_KB}KB → 8B)"
      printf '\x00\x61\x73\x6d\x01\x00\x00\x00' > "$wasm"
    fi
  fi
done

# Stub resvg WASM (not used)
for wasm in $(find .open-next -name "resvg.wasm" 2>/dev/null); do
  SIZE_KB=$(du -k "$wasm" | cut -f1)
  echo "  - Stubbing resvg.wasm (${SIZE_KB}KB → 8B)"
  printf '\x00\x61\x73\x6d\x01\x00\x00\x00' > "$wasm"
done

# ─── Step 4: Verify Prisma WASM in bundle ───
# Cloudflare Workers requires static WASM imports (no dynamic WebAssembly.compile).
# The WASM stays in the bundle (~1.1MB gzip). Total bundle fits within 3MB free tier.
echo "[4/5] Verifying Prisma WASM..."
python3 scripts/patch-wasm-r2.py

AFTER_SIZE=$(du -sk .open-next/ | cut -f1)
SAVED=$(( (BEFORE_SIZE - AFTER_SIZE) / 1024 ))
echo "  - Total saved: ~${SAVED}MB"

# ─── Step 5: Final summary ───
echo ""
echo "[5/5] Build complete!"

# Show final sizes
HANDLER_GZ=$(gzip -c .open-next/server-functions/default/handler.mjs | wc -c)
HANDLER_MB=$(echo "scale=2; $HANDLER_GZ / 1048576" | bc)
echo ""
echo "Bundle sizes:"
echo "  handler.mjs (gzip): ${HANDLER_MB}MB"
echo "  Total .open-next:   $(du -sh .open-next/ | cut -f1)"
echo ""
echo "To deploy:  npm run cf:deploy"
echo "To preview: npm run cf:dev"
