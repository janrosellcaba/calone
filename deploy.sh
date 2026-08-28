#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> frontend: install + build"
cd "$ROOT/frontend"
npm ci
npm run build

echo "==> backend: install, migrate, generate, build"
cd "$ROOT/backend"
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build

echo "==> restart calone"
sudo systemctl restart calone

echo "==> done"
