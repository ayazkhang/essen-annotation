#!/bin/sh
set -e

cd /app/backend

echo "==> [backend] Enabling Yarn"
corepack enable
corepack prepare yarn@1.22.22 --activate

echo "==> [backend] Installing dependencies"
yarn install --frozen-lockfile || yarn install

echo "==> [backend] Generating Prisma client"
yarn prisma:generate

echo "==> [backend] Waiting for Postgres at ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}"
node <<'EOF'
const net = require('net');
const host = process.env.POSTGRES_HOST || 'postgres';
const port = Number(process.env.POSTGRES_PORT || 5432);

function once() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.on('error', reject);
  });
}

(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      await once();
      console.log('Postgres is reachable');
      process.exit(0);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error('Postgres did not become ready in time');
  process.exit(1);
})();
EOF

echo "==> [backend] Running migrations"
yarn prisma:migrate

if [ ! -f /app/demo/audio/op_report_long.wav ]; then
  echo "==> [backend] Generating demo audio"
  yarn generate:demo
fi

if [ "${SEED_ON_START:-1}" = "1" ]; then
  echo "==> [backend] Seeding demo data"
  yarn seed
fi

echo "==> [backend] Starting API"
exec "$@"
