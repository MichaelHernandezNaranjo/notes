# Despliegue (Ubuntu + Docker + Cloudflare Tunnel)

- Frontend: https://notes.d4nthi.com (Nginx)
- API + SignalR: https://api.d4nthi.com (.NET 10)
- BD: SQL Server 2022 Express en volumen `mssqldata`. Ningun puerto se publica al host.

## 0. Antes de empezar (en tu navegador)

1. **Rota el ClientSecret de Google** (Google Cloud > Credenciales). El anterior estuvo en git: dalo por comprometido.
2. En ese cliente OAuth anade la URI de redireccion autorizada:
   `https://notes.d4nthi.com/auth/google/callback`
3. `d4nthi.com` debe usar los nameservers de Cloudflare.

## 1. Preparar el servidor (una vez)

```bash
sudo mkdir -p /opt/notes && sudo chown $USER /opt/notes
git clone git@github.com:MichaelHernandezNaranjo/notes.git ~/notes-setup
cd ~/notes-setup
bash deploy/setup-server.sh     # crea /opt/notes/.env (chmod 600) y carpetas
bash deploy/setup-tunnel.sh     # login Cloudflare, crea tunel, DNS y config.yml
```

Estructura resultante:

```
/opt/notes/
├── .env                    # secretos (no versionado)
├── backups/                # .bak de la base de datos
└── cloudflared/
    ├── cert.pem
    ├── <UUID>.json         # credenciales del tunel
    └── config.yml
```

## 2. Runner de GitHub Actions (en el servidor)

1. GitHub > repo > Settings > Actions > Runners > **New self-hosted runner** (Linux x64).
2. Ejecuta los comandos que te muestra (descargar y `./config.sh --url ... --token ...`).
3. Instala como servicio con el usuario que pertenece al grupo `docker`:
   ```bash
   sudo ./svc.sh install $USER && sudo ./svc.sh start
   ```
4. Mantén el repo **privado** y no habilites workflows para PRs de terceros.

El runner hace polling hacia GitHub: no necesita SSH ni puertos abiertos.

## 3. Desplegar

`git push origin main` ejecuta `.github/workflows/deploy.yml`:
`docker compose up -d --build` (compila en el servidor), aplica migraciones
(`db-init`) y reinicia los servicios. Tambien se puede lanzar a mano
desde la pestana Actions (workflow_dispatch).

### Migraciones de base de datos (automaticas, nunca a mano)

`db-init` corre en cada despliegue y deja la BD al dia:

- `backend/Database/Migrations/NNNN_*.sql`: se aplican **una sola vez**, en orden, cada
  una en su transaccion, y se registran en `dbo.SchemaVersions` con su checksum SHA-256.
  Aqui van tablas nuevas, `ALTER TABLE`, indices y cambios de datos.
- `backend/Database/StoredProcedures/*.sql`: se reaplican siempre (`CREATE OR ALTER`).
- **Nunca edites una migracion ya aplicada**: el checksum cambia y `db-init` falla a
  proposito. Crea una nueva (`0003_...sql`).
- Si hay migraciones pendientes y la BD ya tiene datos, antes se hace un backup
  `NotesAppDb_premigration_<fecha>.bak` en `/opt/notes/backups`.
- Si una migracion falla se revierte, `db-init` sale con error, el backend no arranca y el
  workflow queda en rojo. Revisa `docker compose logs db-init`; los datos siguen intactos.
- `0001_baseline.sql` es idempotente (`IF NOT EXISTS`): sobre la BD de produccion existente
  no cambia nada y solo se registra.
- `db-init` avisa en el log (sin modificar datos) si hay nombres duplicados entre hermanos.
- SQL Server Express **no soporta `BACKUP ... WITH COMPRESSION`**; los scripts no lo usan.

## 4. Respaldos

```bash
chmod +x deploy/backup.sh
( crontab -l 2>/dev/null; echo "0 3 * * * /ruta/al/runner/_work/notes/notes/deploy/backup.sh >> /opt/notes/backup.log 2>&1" ) | crontab -
```
Ajusta la ruta al checkout del runner. Rotacion: 14 dias. Copia `/opt/notes/backups`
tambien fuera del servidor: el volumen y los backups viven en el mismo disco.

## Desarrollo local

`appsettings.json` ya no trae secretos. Configura user-secrets en `backend/`:

```
dotnet user-secrets set "Jwt:Secret" "<32+ caracteres>"
dotnet user-secrets set "Authentication:Google:ClientId" "<id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<secret rotado>"
```

## Comandos utiles

```bash
docker compose --env-file /opt/notes/.env ps
docker compose --env-file /opt/notes/.env logs -f backend
docker compose --env-file /opt/notes/.env logs db-init
```
