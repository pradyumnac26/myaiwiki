#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! python3 -c "import PIL" 2>/dev/null; then
  echo "Installing Pillow for OG image generation..."
  pip3 install --user -r requirements.txt 2>/dev/null || pip3 install -r requirements.txt
fi

python3 scripts/generate_og_images.py

echo "Starting Jekyll at http://127.0.0.1:4000"
echo "Press Ctrl+C to stop."

bundle exec jekyll serve --livereload --host 127.0.0.1
