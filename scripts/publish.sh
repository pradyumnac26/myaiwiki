#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MSG="${1:-Update site $(date +%Y-%m-%d)}"

git add -A
git status --short

if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

git commit -m "$MSG"
git push

echo "Published to GitHub."
