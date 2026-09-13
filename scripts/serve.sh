#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting Jekyll at http://127.0.0.1:4000"
echo "Press Ctrl+C to stop."

bundle exec jekyll serve --livereload --host 127.0.0.1
