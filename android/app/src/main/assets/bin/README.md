# V2Ray Binary Assets

This directory must contain pre-built statically-linked binaries for each Android ABI
before the APK can be built.  The binaries are **not** committed to git (they are
listed in `.gitignore`) and must be downloaded or built separately.

## Expected layout

```
assets/bin/
  arm64-v8a/
    v2ray       ← v2ray-core (or xray-core) for 64-bit ARM
    tun2socks   ← tun2socks v2 for 64-bit ARM
  armeabi-v7a/
    v2ray       ← v2ray-core for 32-bit ARM
    tun2socks   ← tun2socks v2 for 32-bit ARM
  x86_64/
    v2ray       ← v2ray-core for x86_64 (emulators)
    tun2socks   ← tun2socks v2 for x86_64 (emulators)
```

## Quick setup (CI and local dev)

Run the download script from the repo root:

```bash
bash scripts/download-v2ray-binaries.sh
```

This fetches the latest stable releases of:
- **v2ray-core** from https://github.com/v2fly/v2ray-core/releases
- **tun2socks** from https://github.com/xjasonlyu/tun2socks/releases

## Versions

| Binary    | Source                                    | Notes                          |
|-----------|-------------------------------------------|--------------------------------|
| v2ray     | v2fly/v2ray-core ≥ v5.x                   | VLESS + WS + TLS outbound      |
| tun2socks | xjasonlyu/tun2socks ≥ v2.5               | `-device fd://X` flag required |

## Environment variables

Configure V2Ray via `.env` (see `.env.example`):

```
V2RAY_UUID=<your-vless-uuid>
V2RAY_HOST=matrix.sauti.ru
V2RAY_PORT=443
V2RAY_WS_PATH=/your-ws-path
```

## How it works at runtime

1. `BinaryManager` extracts these files to `<filesDir>/bin/` on first launch and
   re-extracts whenever the APK is updated (via APK last-modified timestamp stamp).
2. `SautiVpnService` resolves the V2Ray server hostname, sets up the TUN interface
   with IPv4 routes that **exclude** the server IP (preventing a routing loop), then:
   - Starts `v2ray` with a generated VLESS+WS+TLS config (SOCKS5 inbound on :10808).
   - Waits for port 10808 to open (≤ 10 s).
   - Starts `tun2socks` pointing at `fd://<tun-fd>` → `socks5://127.0.0.1:10808`.
