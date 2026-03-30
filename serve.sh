#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"

echo "Serving static files at http://localhost:${PORT}"
python3 -m http.server "${PORT}"
