#!/usr/bin/env bash
# =============================================================================
# Sauti Backend — Deploy Updated Configs
# =============================================================================
#
# Pushes updated config files to a running server and restarts affected services.
# Use this after changing conduit.toml, nginx/default.conf, v2ray/config.json,
# or coturn/turnserver.conf.
#
# Usage:
#   SERVER_IP=1.2.3.4 bash deploy.sh
#
# Prerequisite: SSH key-based access to root@SERVER_IP must be configured.
# =============================================================================
set -euo pipefail

SERVER_IP="${SERVER_IP:-}"
if [[ -z "$SERVER_IP" ]]; then
  echo "ERROR: Set SERVER_IP before running."
  echo "  Example: SERVER_IP=1.2.3.4 bash deploy.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Deploying Sauti backend configs to root@${SERVER_IP}..."

echo "  • conduit.toml"
scp "${BACKEND_DIR}/conduit/conduit.toml" "root@${SERVER_IP}:/etc/conduit.toml"

echo "  • nginx/default.conf"
scp "${BACKEND_DIR}/nginx/default.conf" "root@${SERVER_IP}:/etc/nginx/sites-available/sauti"

echo "  • v2ray/config.json"
ssh "root@${SERVER_IP}" "mkdir -p /etc/v2ray"
scp "${BACKEND_DIR}/v2ray/config.json" "root@${SERVER_IP}:/etc/v2ray/config.json"

echo "  • coturn/turnserver.conf"
scp "${BACKEND_DIR}/coturn/turnserver.conf" "root@${SERVER_IP}:/etc/turnserver.conf"

echo "==> Restarting services..."
ssh "root@${SERVER_IP}" "bash -s" <<'REMOTE'
set -e
nginx -t
systemctl reload nginx
systemctl restart conduit
systemctl restart v2ray
systemctl restart coturn
echo "All services restarted successfully."
systemctl is-active --quiet conduit && echo "  conduit  : running" || echo "  conduit  : FAILED"
systemctl is-active --quiet v2ray   && echo "  v2ray    : running" || echo "  v2ray    : FAILED"
systemctl is-active --quiet coturn  && echo "  coturn   : running" || echo "  coturn   : FAILED"
systemctl is-active --quiet nginx   && echo "  nginx    : running" || echo "  nginx    : FAILED"
REMOTE

echo ""
echo "==> Smoke test:"
echo "  curl https://\$(grep server_name ${BACKEND_DIR}/nginx/default.conf | head -1 | awk '{print \$2}' | tr -d ';')/_matrix/client/versions"
echo ""
echo "==> Done."
