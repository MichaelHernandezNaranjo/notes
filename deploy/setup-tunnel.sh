#!/bin/bash
# One-time Cloudflare Tunnel setup. Requires `deploy/setup-server.sh` to have run first.
#   bash deploy/setup-tunnel.sh
set -euo pipefail

DIR=/opt/notes/cloudflared
TUNNEL=notes
cf() { docker run --rm -it -v "$DIR":/home/nonroot/.cloudflared cloudflare/cloudflared:latest "$@"; }

# 1. Authorize (prints a URL: open it, pick the d4nthi.com zone). Writes cert.pem.
[ -f "$DIR/cert.pem" ] || cf tunnel login

# 2. Create the tunnel (writes <UUID>.json credentials).
if ! ls "$DIR"/*.json >/dev/null 2>&1; then
  cf tunnel create "$TUNNEL"
fi
UUID=$(basename "$(ls "$DIR"/*.json | head -n1)" .json)

# 3. DNS CNAMEs pointing at the tunnel.
cf tunnel route dns "$TUNNEL" notes.d4nthi.com || true
cf tunnel route dns "$TUNNEL" api.d4nthi.com || true

# 4. Ingress config consumed by the `cloudflared` compose service.
cat > "$DIR/config.yml" <<EOF
tunnel: $UUID
credentials-file: /etc/cloudflared/$UUID.json
ingress:
  - hostname: notes.d4nthi.com
    service: http://frontend:80
  - hostname: api.d4nthi.com
    service: http://backend:8080
  - service: http_status:404
EOF
# The cloudflared image runs as non-root: make credentials readable.
chmod 644 "$DIR"/*.json "$DIR/config.yml"
echo "Tunnel $UUID ready. Config at $DIR/config.yml"
