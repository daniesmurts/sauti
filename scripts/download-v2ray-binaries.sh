#!/usr/bin/env bash
# download-v2ray-binaries.sh
#
# Downloads pre-built v2ray-core and tun2socks binaries for Android ABIs and
# places them under android/app/src/main/assets/bin/<abi>/.
#
# Usage:
#   bash scripts/download-v2ray-binaries.sh
#
# Override versions via environment variables:
#   V2RAY_VERSION=v5.15.2 TUN2SOCKS_VERSION=v2.5.2 bash scripts/download-v2ray-binaries.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_BIN="$REPO_ROOT/android/app/src/main/assets/bin"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

# ── Versions (override via env) ──────────────────────────────────────────────
V2RAY_VERSION="${V2RAY_VERSION:-v5.15.2}"
TUN2SOCKS_VERSION="${TUN2SOCKS_VERSION:-v2.5.2}"

echo "▶ Downloading v2ray-core $V2RAY_VERSION and tun2socks $TUN2SOCKS_VERSION"

# ── ABI map ─────────────────────────────────────────────────────────────────
# ABI => v2ray archive suffix / tun2socks archive suffix
declare -A V2RAY_ARCH=(
  ["arm64-v8a"]="android-arm64-v8a"
  ["armeabi-v7a"]="android-arm32-v7a"
  ["x86_64"]="android-x86_64"
)
declare -A TUN2SOCKS_ARCH=(
  ["arm64-v8a"]="android-arm64"
  ["armeabi-v7a"]="android-armv7"
  ["x86_64"]="android-amd64"
)

download() {
  local url="$1" dest="$2"
  echo "  ↓ $url"
  curl -fsSL "$url" -o "$dest"
}

for ABI in arm64-v8a armeabi-v7a x86_64; do
  DEST_DIR="$ASSETS_BIN/$ABI"
  mkdir -p "$DEST_DIR"

  # ── v2ray-core ──────────────────────────────────────────────────────────
  V2RAY_ARCHIVE="v2ray-${V2RAY_ARCH[$ABI]}.zip"
  V2RAY_URL="https://github.com/v2fly/v2ray-core/releases/download/${V2RAY_VERSION}/${V2RAY_ARCHIVE}"
  download "$V2RAY_URL" "$TMP_DIR/$V2RAY_ARCHIVE"
  unzip -o -j "$TMP_DIR/$V2RAY_ARCHIVE" "v2ray" -d "$DEST_DIR" 2>/dev/null || \
    unzip -o -j "$TMP_DIR/$V2RAY_ARCHIVE" "*/v2ray" -d "$DEST_DIR"
  chmod +x "$DEST_DIR/v2ray"

  # ── tun2socks ────────────────────────────────────────────────────────────
  TUN2SOCKS_ARCHIVE="tun2socks-${TUN2SOCKS_ARCH[$ABI]}.zip"
  TUN2SOCKS_URL="https://github.com/xjasonlyu/tun2socks/releases/download/${TUN2SOCKS_VERSION}/${TUN2SOCKS_ARCHIVE}"
  download "$TUN2SOCKS_URL" "$TMP_DIR/$TUN2SOCKS_ARCHIVE"
  unzip -o -j "$TMP_DIR/$TUN2SOCKS_ARCHIVE" "tun2socks" -d "$DEST_DIR" 2>/dev/null || \
    unzip -o -j "$TMP_DIR/$TUN2SOCKS_ARCHIVE" "*/tun2socks" -d "$DEST_DIR"
  chmod +x "$DEST_DIR/tun2socks"

  echo "  ✓ $ABI: v2ray $(du -sh "$DEST_DIR/v2ray" | cut -f1)  tun2socks $(du -sh "$DEST_DIR/tun2socks" | cut -f1)"
done

echo ""
echo "✅ Binaries ready in $ASSETS_BIN"
echo "   Next: run 'pnpm android' or 'cd android && ./gradlew assembleDebug'"
