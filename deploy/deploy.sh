#!/usr/bin/env bash
# Build-is-deploy for GamePlan. Rebuilds the Next standalone bundle, stages the
# static assets the standalone server needs, and restarts the systemd service.
#
# Usage: deploy/deploy.sh   (run from anywhere; resolves its own project root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> prisma generate"
npx prisma generate

echo "==> next build (standalone)"
npm run build

echo "==> stage standalone static assets"
# The standalone server serves these relative to its own dir; Next does not
# copy them automatically.
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
fi

echo "==> restart service"
sudo systemctl restart gameplan-web

echo "==> done. status:"
systemctl --no-pager --lines=3 status gameplan-web || true
