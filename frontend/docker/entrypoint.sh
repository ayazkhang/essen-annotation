#!/bin/sh
set -e

cd /app/frontend

echo "==> [frontend] Enabling Yarn"
corepack enable
corepack prepare yarn@1.22.22 --activate

echo "==> [frontend] Installing dependencies"
yarn install --frozen-lockfile || yarn install

echo "==> [frontend] Starting Vite"
exec "$@"
