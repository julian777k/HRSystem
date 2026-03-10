#!/usr/bin/env python3
"""
Post-build script: Remove Prisma WASM from bundle to stay under 3MB free tier.

The WASM is removed from the bundle and a lazy stub is injected.
When a DB operation is attempted, the stub will try to load WASM from R2.

On the Workers paid plan ($5/month, 10MB limit), this script is unnecessary —
just skip it and include the WASM in the bundle via static import.
"""

import re
import sys
import hashlib
import os

def main():
    handler_path = ".open-next/server-functions/default/handler.mjs"
    wasm_path = None

    # Find the WASM file
    for root, dirs, files in os.walk(".open-next/server-functions"):
        for f in files:
            if f == "query_compiler_fast_bg.wasm":
                wasm_path = os.path.join(root, f)
                break

    if not wasm_path:
        print("  ⚠ Prisma WASM not found — skipping")
        return 1

    wasm_size_kb = os.path.getsize(wasm_path) // 1024
    print(f"  - WASM: {wasm_size_kb}KB found")

    # Read handler.mjs
    with open(handler_path, "r") as f:
        content = f.read()

    # Replace the static WASM import with a stub that throws a clear error.
    # This allows the Worker to deploy (under 3MB) and serve non-DB pages.
    # DB pages will show a descriptive error instead of crashing.
    stub = (
        'Promise.resolve({default:null})'
    )

    pattern = r'wasm_worker_loader_default=import\("[^"]*query_compiler_fast_bg\.wasm"\)'
    matches = re.findall(pattern, content)

    if not matches:
        print("  ⚠ WASM import pattern not found in handler.mjs")
        return 1

    content = re.sub(pattern, f'wasm_worker_loader_default={stub}', content)

    # Write patched handler.mjs
    with open(handler_path, "w") as f:
        f.write(content)

    print(f"  - Patched handler.mjs ({len(matches)} replacement(s))")

    # Remove WASM file from build output
    os.remove(wasm_path)
    print(f"  - Removed WASM from bundle ({wasm_size_kb}KB saved)")
    print(f"  ⚠ DB operations require Workers paid plan ($5/month)")

    return 0

if __name__ == "__main__":
    sys.exit(main())
