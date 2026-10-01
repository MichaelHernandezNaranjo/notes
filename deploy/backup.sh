#!/bin/bash
# Compressed full backup of NotesAppDb into $BACKUP_DIR (mounted at /backups in the db container).
# Keeps 14 days. Schedule daily with cron (see deploy/README.md).
set -euo pipefail

ENV_FILE=/opt/notes/.env
set -a; . "$ENV_FILE"; set +a
BACKUP_DIR=${BACKUP_DIR:-/opt/notes/backups}
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="/backups/NotesAppDb_${STAMP}.bak"

cd "$(dirname "$0")/.."
docker compose --env-file "$ENV_FILE" exec -T db /opt/mssql-tools18/bin/sqlcmd \
  -C -b -S localhost -U sa -P "$SA_PASSWORD" \
  -Q "BACKUP DATABASE NotesAppDb TO DISK = N'$FILE' WITH COMPRESSION, CHECKSUM, INIT;"

find "$BACKUP_DIR" -name 'NotesAppDb_*.bak' -mtime +14 -delete
echo "Backup written: $BACKUP_DIR/NotesAppDb_${STAMP}.bak"
