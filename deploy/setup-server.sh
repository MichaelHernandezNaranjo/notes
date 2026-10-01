#!/bin/bash
# One-time server preparation. Run as the deploy user (must be in the `docker` group):
#   bash deploy/setup-server.sh
set -euo pipefail

BASE=/opt/notes
sudo mkdir -p "$BASE/cloudflared" "$BASE/backups"
sudo chown -R "$USER":"$USER" "$BASE"
# SQL Server in the container runs as uid 10001 and must write backups here.
sudo chown 10001:0 "$BASE/backups"

if [ -f "$BASE/.env" ]; then
  echo ".env already exists at $BASE/.env - not overwriting."
  exit 0
fi

gen() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }

read -rp "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -rsp "GOOGLE_CLIENT_SECRET (hidden): " GOOGLE_CLIENT_SECRET
echo

# SA password must satisfy SQL Server complexity: upper, lower, digits.
cat > "$BASE/.env" <<EOF
SA_PASSWORD=Sa$(gen 30)9x
APP_DB_PASSWORD=App$(gen 30)7y
JWT_SECRET=$(gen 64)
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
BACKUP_DIR=$BASE/backups
EOF
chmod 600 "$BASE/.env"
echo "Created $BASE/.env (chmod 600)."
