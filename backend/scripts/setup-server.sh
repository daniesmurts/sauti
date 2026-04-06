#!/usr/bin/env bash
# =============================================================================
# Sauti Backend — Full Server Setup
# =============================================================================
#
# Target OS : Ubuntu 22.04 LTS (Hetzner CPX21 or equivalent)
# Run as    : root
# Usage     : DOMAIN=matrix.yourdomain.com bash setup-server.sh
#
# What this installs:
#   - Conduwuit (Matrix homeserver, port 6167, internal only)
#   - V2Ray    (VLESS+WebSocket obfuscation proxy, 127.0.0.1:10086)
#   - Nginx    (TLS termination + reverse proxy, ports 80/443)
#   - Coturn   (TURN server, ports 3478 / 5349 / 443 TCP)
#   - Certbot  (Let's Encrypt TLS certificates)
#
# Secrets generated automatically and printed at the end.
# Copy them into your app .env and Supabase secrets.
#
# NOTE: If you run Coturn on a separate VPS, copy the [COTURN] section
# of this script to that machine and skip [CONDUIT] and [V2RAY].
# =============================================================================
set -euo pipefail

# ── REQUIRED INPUT ─────────────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: Set DOMAIN before running."
  echo "  Example: DOMAIN=matrix.yourdomain.com bash setup-server.sh"
  exit 1
fi

# ── AUTO-GENERATED SECRETS ────────────────────────────────────────────────────
V2RAY_UUID="$(cat /proc/sys/kernel/random/uuid)"
V2RAY_PATH="/$(openssl rand -hex 12)"
TURN_SECRET="$(openssl rand -hex 32)"
TURN_USERNAME="sauti"

# ── PINNED VERSIONS ───────────────────────────────────────────────────────────
# Check https://github.com/x86pup/conduwuit/releases for latest
CONDUWUIT_VERSION="${CONDUWUIT_VERSION:-0.4.6}"
# Check https://github.com/v2fly/v2ray-core/releases for latest
V2RAY_VERSION="${V2RAY_VERSION:-5.14.1}"

echo "════════════════════════════════════════════════════════════════════════"
echo " Sauti Backend Setup"
echo " Domain  : ${DOMAIN}"
echo " Conduwuit : v${CONDUWUIT_VERSION}"
echo " V2Ray   : v${V2RAY_VERSION}"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ── SYSTEM PACKAGES ───────────────────────────────────────────────────────────
echo "==> [1/8] Installing system packages..."
apt-get update -qq
apt-get install -y --no-install-recommends \
  nginx \
  coturn \
  certbot \
  python3-certbot-nginx \
  curl \
  unzip \
  openssl \
  ufw

# ── CONDUWUIT ─────────────────────────────────────────────────────────────────
echo "==> [2/8] Installing Conduwuit v${CONDUWUIT_VERSION}..."
curl -fsSL \
  "https://github.com/x86pup/conduwuit/releases/download/v${CONDUWUIT_VERSION}/static-x86_64-unknown-linux-musl" \
  -o /usr/local/bin/conduwuit
chmod +x /usr/local/bin/conduwuit

useradd --system --no-create-home --shell /usr/sbin/nologin conduit 2>/dev/null || true
mkdir -p /var/lib/conduit
chown -R conduit:conduit /var/lib/conduit

cat > /etc/conduit.toml <<EOF
[global]
server_name = "${DOMAIN}"
database_backend = "rocksdb"
database_path = "/var/lib/conduit/rocksdb"
port = 6167
address = "127.0.0.1"
max_request_size = 20_000_000
allow_registration = true
yes_i_am_very_very_sure_i_want_an_open_registration_server_prone_to_abuse = true
allow_federation = false
allow_room_creation = true
allow_encryption = true
log = "warn"
EOF

# Registration starts enabled so the first admin account can be created.
# The bootstrap step at the end of this script guides you through getting
# the admin token, then registration is disabled.

cat > /etc/systemd/system/conduit.service <<EOF
[Unit]
Description=Conduwuit Matrix Homeserver
After=network.target

[Service]
User=conduit
ExecStart=/usr/local/bin/conduwuit -c /etc/conduit.toml
Restart=on-failure
RestartSec=5s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# ── V2RAY ─────────────────────────────────────────────────────────────────────
echo "==> [3/8] Installing V2Ray v${V2RAY_VERSION}..."
curl -fsSL \
  "https://github.com/v2fly/v2ray-core/releases/download/v${V2RAY_VERSION}/v2ray-linux-64.zip" \
  -o /tmp/v2ray.zip
mkdir -p /tmp/v2ray-extract /usr/local/share/v2ray
unzip -o /tmp/v2ray.zip -d /tmp/v2ray-extract
install -m 755 /tmp/v2ray-extract/v2ray /usr/local/bin/v2ray
install -m 644 /tmp/v2ray-extract/geoip.dat /usr/local/share/v2ray/ 2>/dev/null || true
install -m 644 /tmp/v2ray-extract/geosite.dat /usr/local/share/v2ray/ 2>/dev/null || true
rm -rf /tmp/v2ray.zip /tmp/v2ray-extract

mkdir -p /etc/v2ray
cat > /etc/v2ray/config.json <<EOF
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "port": 10086,
      "listen": "127.0.0.1",
      "protocol": "vless",
      "settings": {
        "clients": [{ "id": "${V2RAY_UUID}", "level": 0 }],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": { "path": "${V2RAY_PATH}" }
      }
    }
  ],
  "outbounds": [{ "protocol": "freedom", "settings": {} }]
}
EOF

cat > /etc/systemd/system/v2ray.service <<EOF
[Unit]
Description=V2Ray Proxy Service
After=network.target

[Service]
ExecStart=/usr/local/bin/v2ray run -config /etc/v2ray/config.json
Restart=on-failure
RestartSec=5s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# ── COTURN ────────────────────────────────────────────────────────────────────
echo "==> [4/8] Configuring Coturn..."
cat > /etc/turnserver.conf <<EOF
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
user=${TURN_USERNAME}:${TURN_SECRET}
realm=${DOMAIN}
cert=/etc/letsencrypt/live/${DOMAIN}/fullchain.pem
pkey=/etc/letsencrypt/live/${DOMAIN}/privkey.pem
total-quota=100
bps-capacity=0
stale-nonce=600
no-stdout-log
syslog
log-file=/var/log/turnserver.log
EOF

# Enable coturn daemon
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || \
  echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn

# ── NGINX (pre-cert, HTTP only for ACME challenge) ────────────────────────────
echo "==> [5/8] Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot
mkdir -p /var/www/certbot/.well-known/acme-challenge

cat > /etc/nginx/sites-available/sauti <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
  location ^~ /.well-known/acme-challenge/ { alias /var/www/certbot/.well-known/acme-challenge/; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
ln -sf /etc/nginx/sites-available/sauti /etc/nginx/sites-enabled/sauti
nginx -t
systemctl enable --now nginx
systemctl reload nginx

# ── TLS CERTIFICATE ───────────────────────────────────────────────────────────
echo "==> [6/8] Obtaining TLS certificate for ${DOMAIN}..."
echo "    (DNS A record for ${DOMAIN} must already point to this server's IP)"
certbot certonly --webroot \
  -w /var/www/certbot \
  --non-interactive --agree-tos \
  --email "admin@${DOMAIN}" \
  -d "${DOMAIN}"

# ── NGINX (full config with TLS + proxies) ────────────────────────────────────
echo "==> [7/8] Applying full Nginx config with TLS..."
cat > /etc/nginx/sites-available/sauti <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
  location ^~ /.well-known/acme-challenge/ { alias /var/www/certbot/.well-known/acme-challenge/; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # V2Ray WebSocket — obfuscated proxy traffic
    location ${V2RAY_PATH} {
        proxy_pass http://127.0.0.1:10086;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_buffering off;
    }

    # Conduit Matrix homeserver
    location /_matrix {
        proxy_pass http://127.0.0.1:6167;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Host \$host;
        client_max_body_size 20M;
    }

    # Matrix .well-known discovery
    location /.well-known/matrix {
        proxy_pass http://127.0.0.1:6167;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / { return 404; }
}
EOF
nginx -t

# ── FIREWALL ──────────────────────────────────────────────────────────────────
echo "==> [8/8] Configuring firewall..."
ufw --force enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 5349/udp

# ── START ALL SERVICES ────────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable --now conduit v2ray coturn
systemctl reload nginx

# ── CERTBOT RENEWAL CRON ─────────────────────────────────────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx coturn") | crontab -

# ─────────────────────────────────────────────────────────────────────────────
# BOOTSTRAP: Get admin Matrix token
# Conduit started with allow_registration=true so the first account is admin.
# Run these commands NOW before continuing:
#
#   # Register admin user (replace password):
#   curl -sX POST "https://${DOMAIN}/_matrix/client/v3/register" \
#     -H "Content-Type: application/json" \
#     -d '{"username":"sauti_admin","password":"CHANGE_THIS_PASSWORD","auth":{"type":"m.login.dummy"}}' \
#     | python3 -m json.tool
#
#   # Copy the "access_token" from the response, then lock down registration:
#   sed -i 's/allow_registration = true/allow_registration = false/' /etc/conduit.toml
#   systemctl restart conduit
#
# Set the admin token in Supabase so the edge function can create accounts:
#   SUPABASE_ACCESS_TOKEN=your_token supabase secrets set \
#     MATRIX_PROVISIONING_API_URL=https://${DOMAIN} \
#     MATRIX_PROVISIONING_API_TOKEN=<access_token_from_above>
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo " Sauti Backend Setup Complete"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo " ⚠  COPY THESE INTO YOUR APP .env FILE:"
echo ""
echo "  MATRIX_HOMESERVER_URL=https://${DOMAIN}"
echo "  MATRIX_HOMESERVER_DOMAIN=${DOMAIN}"
echo "  V2RAY_UUID=${V2RAY_UUID}"
echo "  V2RAY_PATH=${V2RAY_PATH}"
echo "  V2RAY_HOST=${DOMAIN}"
echo "  CF_FRONTING_HOST=cdn.cloudflare.com"
echo "  CF_ORIGIN_HOST=${DOMAIN}"
echo "  TURN_SERVER_URL=turns:${DOMAIN}:5349?transport=tcp"
echo "  TURN_SERVER_USERNAME=${TURN_USERNAME}"
echo "  TURN_SERVER_CREDENTIAL=${TURN_SECRET}"
echo ""
echo " ⚠  SAVE THIS — needed if you re-deploy or rotate credentials:"
echo "  TURN_SECRET=${TURN_SECRET}"
echo ""
echo " Smoke tests:"
echo "  curl https://${DOMAIN}/_matrix/client/versions"
echo "  systemctl status conduit v2ray coturn nginx"
echo ""
echo " Next: register the Matrix admin user (see bootstrap instructions above)"
echo "════════════════════════════════════════════════════════════════════════"
