#!/bin/bash
# Versioned DB bootstrap, runs on every deploy (compose service `db-init`).
#  1. creates NotesAppDb and the SchemaVersions table
#  2. applies pending Migrations/*.sql once each (own transaction, checksum-protected)
#  3. re-applies StoredProcedures/*.sql (CREATE OR ALTER, always safe)
#  4. configures the least-privilege app login and prints a read-only duplicate-name report
# Any failure exits non-zero, so the backend does not start and the deploy goes red.
set -euo pipefail

SQLCMD=/opt/mssql-tools18/bin/sqlcmd
SQL_DIR=${SQL_DIR:-/sql}
DB_HOST=${DB_HOST:-db}
sa() { "$SQLCMD" -C -b -I -S "$DB_HOST" -U sa -P "$SA_PASSWORD" "$@"; }
# Scalar query helper: prints a single trimmed value.
val() { sa -d NotesAppDb -h -1 -W -Q "SET NOCOUNT ON; $1" | tr -d '\r' | head -n1; }

echo "[db-init] waiting for SQL Server..."
for i in $(seq 1 60); do
  sa -Q "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
  [ "$i" = 60 ] && { echo "[db-init] SQL Server did not become ready"; exit 1; }
done

echo "[db-init] ensuring database NotesAppDb"
sa -Q "IF DB_ID('NotesAppDb') IS NULL CREATE DATABASE NotesAppDb;"

sa -d NotesAppDb -Q "
IF OBJECT_ID('dbo.SchemaVersions') IS NULL
    CREATE TABLE dbo.SchemaVersions (
        ScriptName NVARCHAR(200) NOT NULL CONSTRAINT PK_SchemaVersions PRIMARY KEY,
        Checksum   CHAR(64)      NOT NULL,
        AppliedAt  DATETIME2(3)  NOT NULL CONSTRAINT DF_SchemaVersions_AppliedAt DEFAULT SYSUTCDATETIME()
    );"

# ---------- Pending migrations ----------
pending=()
for f in $(ls "$SQL_DIR"/Migrations/*.sql 2>/dev/null | sort); do
  name=$(basename "$f")
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  applied=$(val "SELECT Checksum FROM dbo.SchemaVersions WHERE ScriptName = N'$name'")
  if [ -z "$applied" ]; then
    pending+=("$f")
  elif [ "$applied" != "$sum" ]; then
    echo "[db-init] ERROR: migration $name was already applied but its content changed."
    echo "          Never edit an applied migration; add a new numbered script instead."
    exit 1
  fi
done

if [ ${#pending[@]} -gt 0 ]; then
  echo "[db-init] ${#pending[@]} pending migration(s)"

  # Back up first, but only when the database already holds data (not on a brand-new database).
  if [ "$(val "SELECT CASE WHEN OBJECT_ID('dbo.Users') IS NOT NULL THEN 1 ELSE 0 END")" = "1" ]; then
    stamp=$(date +%Y%m%d_%H%M%S)
    echo "[db-init] pre-migration backup -> /backups/NotesAppDb_premigration_${stamp}.bak"
    sa -Q "BACKUP DATABASE NotesAppDb TO DISK = N'/backups/NotesAppDb_premigration_${stamp}.bak' WITH CHECKSUM, INIT;"
  fi

  for f in "${pending[@]}"; do
    name=$(basename "$f")
    sum=$(sha256sum "$f" | cut -d' ' -f1)
    echo "[db-init] applying $name"
    # One transaction per migration (incl. its SchemaVersions row). On any error sqlcmd exits (-b),
    # the connection closes and SQL Server rolls the whole script back.
    tmp=$(mktemp)
    {
      echo "SET XACT_ABORT ON;"
      echo "BEGIN TRAN;"
      echo "GO"
      cat "$f"
      echo
      echo "GO"
      echo "INSERT INTO dbo.SchemaVersions (ScriptName, Checksum) VALUES (N'$name', '$sum');"
      echo "COMMIT TRAN;"
      echo "GO"
    } > "$tmp"
    if ! sa -d NotesAppDb -i "$tmp"; then
      rm -f "$tmp"
      echo "[db-init] ERROR: migration $name failed and was rolled back."
      exit 1
    fi
    rm -f "$tmp"
  done
else
  echo "[db-init] schema is up to date"
fi

# ---------- Stored procedures (idempotent) ----------
echo "[db-init] applying stored procedures"
for f in $(ls "$SQL_DIR"/StoredProcedures/*.sql | sort); do
  echo "  - $(basename "$f")"
  sa -d NotesAppDb -i "$f"
done

# ---------- App login (EXECUTE only) ----------
echo "[db-init] configuring app login (EXECUTE only)"
sa -v APPPWD="$APP_DB_PASSWORD" -Q "
IF SUSER_ID('notesapp') IS NULL
  CREATE LOGIN notesapp WITH PASSWORD = '\$(APPPWD)', CHECK_POLICY = OFF;
ELSE
  ALTER LOGIN notesapp WITH PASSWORD = '\$(APPPWD)';"
sa -d NotesAppDb -Q "
IF USER_ID('notesapp') IS NULL CREATE USER notesapp FOR LOGIN notesapp;
GRANT EXECUTE ON SCHEMA::dbo TO notesapp;"

# ---------- Read-only report: sibling nodes sharing a name (would block restore/rename) ----------
dups=$(val "SELECT COUNT(*) FROM (SELECT 1 AS x FROM dbo.Nodes WHERE IsDeleted = 0 GROUP BY ISNULL(ParentId,'00000000-0000-0000-0000-000000000000'), Name HAVING COUNT(*) > 1) d")
if [ "${dups:-0}" != "0" ]; then
  echo "[db-init] WARNING: $dups folder/name combination(s) contain duplicate sibling names (data left untouched):"
  sa -d NotesAppDb -W -Q "SELECT TOP 20 ISNULL(CONVERT(VARCHAR(36), ParentId), '(root)') AS ParentId, Name, COUNT(*) AS Copies FROM dbo.Nodes WHERE IsDeleted = 0 GROUP BY ISNULL(CONVERT(VARCHAR(36), ParentId), '(root)'), ParentId, Name HAVING COUNT(*) > 1;"
fi

# ---------- Read-only report: users already above their storage limit (they become read-only until they free space) ----------
over=$(val "SELECT COUNT(*) FROM dbo.Users u WHERE u.IsSuperAdmin = 0 AND dbo.fn_UsedBytes(u.Id) > ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes())")
if [ "${over:-0}" != "0" ]; then
  echo "[db-init] WARNING: $over user(s) use more space than their limit (read-only until they free space or you raise the limit in /admin):"
  sa -d NotesAppDb -W -Q "SELECT TOP 20 u.Email, dbo.fn_UsedBytes(u.Id) / 1048576 AS UsedMB, ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) / 1048576 AS LimitMB FROM dbo.Users u WHERE u.IsSuperAdmin = 0 AND dbo.fn_UsedBytes(u.Id) > ISNULL(u.StorageQuotaBytes, dbo.fn_DefaultQuotaBytes()) ORDER BY dbo.fn_UsedBytes(u.Id) DESC;"
fi

echo "[db-init] done"
