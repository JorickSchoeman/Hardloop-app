#!/bin/zsh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -d node_modules ]]; then
  echo "node_modules ontbreekt; draai eerst npm install."
  exit 1
fi

echo "Start hardloop dashboard..."
npm run dev