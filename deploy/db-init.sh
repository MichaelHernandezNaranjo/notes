#!/bin/bash
# Idempotent DB bootstrap, runs on every deploy (compose service `db-init`).
# Creates NotesAppDb, applies tables + stored procedures, and creates a least-privilege app login.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
sa() { "$SQLCMD" -C -b -I -S db -U sa -P "$SA_PASSWORD" "$@"; }

echo "[db-init] waiting for SQL Server..."
for i in $(seq 1 30); do
  sa -Q "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done

echo "[db-init] ensuring database NotesAppDb"
sa -Q "IF DB_ID('NotesAppDb') IS NULL CREATE DATABASE NotesAppDb;"

echo "[db-init] applying tables"
for f in $(ls /sql/Tables/*.sql | sort); do
  echo "  - $f"
  sa -d NotesAppDb -i "$f"
done

echo "[db-init] applying stored procedures"
for f in $(ls /sql/StoredProcedures/*.sql | sort); do
  echo "  - $f"
  sa -d NotesAppDb -i "$f"
done

echo "[db-init] configuring app login (EXECUTE only)"
sa -v APPPWD="$APP_DB_PASSWORD" -Q "
IF SUSER_ID('notesapp') IS NULL
  CREATE LOGIN notesapp WITH PASSWORD = '\$(APPPWD)', CHECK_POLICY = OFF;
ELSE
  ALTER LOGIN notesapp WITH PASSWORD = '\$(APPPWD)';"
sa -d NotesAppDb -Q "
IF USER_ID('notesapp') IS NULL CREATE USER notesapp FOR LOGIN notesapp;
GRANT EXECUTE ON SCHEMA::dbo TO notesapp;"

echo "[db-init] done"
