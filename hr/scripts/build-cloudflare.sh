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

# ─── Step 4.5: Remove unnecessary node_modules from bundle ───
echo "[4.5/5] Cleaning unnecessary dependencies from bundle..."

CLEAN_DIR=".open-next/server-functions/default/node_modules"
CLEANED=0

# Prisma WASM base64 files (81MB+ — D1 client replaces Prisma on CF)
if [ -d "$CLEAN_DIR/@prisma" ]; then
  PRISMA_SIZE=$(du -sm "$CLEAN_DIR/@prisma" | cut -f1)
  rm -rf "$CLEAN_DIR/@prisma"
  echo "  - Removed @prisma/ (${PRISMA_SIZE}MB)"
  CLEANED=$((CLEANED + PRISMA_SIZE))
fi
if [ -d "$CLEAN_DIR/.prisma" ]; then
  DOTPRISMA_SIZE=$(du -sm "$CLEAN_DIR/.prisma" | cut -f1)
  rm -rf "$CLEAN_DIR/.prisma"
  echo "  - Removed .prisma/ (${DOTPRISMA_SIZE}MB)"
  CLEANED=$((CLEANED + DOTPRISMA_SIZE))
fi

# better-sqlite3 native binary (macOS — can't run on Workers)
if [ -d "$CLEAN_DIR/better-sqlite3" ]; then
  BS3_SIZE=$(du -sm "$CLEAN_DIR/better-sqlite3" | cut -f1)
  rm -rf "$CLEAN_DIR/better-sqlite3"
  echo "  - Removed better-sqlite3/ (${BS3_SIZE}MB)"
  CLEANED=$((CLEANED + BS3_SIZE))
fi

# PostgreSQL client (D1 used, not PostgreSQL)
for pkg in pg pg-cloudflare pg-connection-string pg-int8 pg-pool pg-protocol pg-types pgpass postgres-array postgres-bytea postgres-date postgres-interval; do
  if [ -d "$CLEAN_DIR/$pkg" ]; then
    rm -rf "$CLEAN_DIR/$pkg"
  fi
done
echo "  - Removed pg* packages"

# Source maps (no use in production)
find .open-next -name "*.map" -delete 2>/dev/null
echo "  - Removed source maps"

# TypeScript declarations (no use at runtime)
find .open-next -name "*.d.ts" -delete 2>/dev/null
find .open-next -name "*.d.mts" -delete 2>/dev/null
echo "  - Removed TypeScript declarations"

echo "  - Total cleaned: ~${CLEANED}MB"

AFTER_SIZE=$(du -sk .open-next/ | cut -f1)
SAVED=$(( (BEFORE_SIZE - AFTER_SIZE) / 1024 ))
echo "  - Total saved from original: ~${SAVED}MB"

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
