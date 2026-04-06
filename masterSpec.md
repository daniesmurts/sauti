# Sauti— Master Build Specification
> Censorship-resistant messaging & VoIP for African students in Russia
> Version 1.0 | React Native (bare workflow) + TypeScript

---


## 1. Project mission & context

Sauti is a censorship-resistant, low-bandwidth messaging and VoIP calling application
built specifically for African students studying in Russia, and their families back home.

**The core problem:** WhatsApp, Telegram, and most Western communication apps are
throttled or blocked by Russian ISPs using deep-packet inspection (DPI). Students are
cut off from family at critical moments.

**The solution:** A purpose-built app that routes all traffic through obfuscated tunnels,
uses low-bandwidth codecs, handles offline gracefully, and works reliably at 2G speeds.

### 1.1 Target users

- **Primary (Russia-side):** African students at Russian universities. Android-first.
  Expect poor/throttled connectivity, 2G–4G. Must bypass DPI.
- **Secondary (Africa-side):** Family members at home. Varied connectivity (Nigeria,
  Ghana, Kenya, Ethiopia, etc.). Android-first. Less censorship pressure but
  sometimes low bandwidth and high latency.

### 1.2 Non-negotiables

- Messages must be end-to-end encrypted (E2EE). No exceptions.
- App must function on 2G (EDGE, ~100kbps). Voice calls must work at 50kbps.
- No plaintext metadata transmitted to any Russian-jurisdiction server.
- Offline message queue: messages typed while offline must send when back online.
- Cold start to usable UI in under 3 seconds on a mid-range Android (2019+).

---

## 2. Platform & React Native decision

### 2.1 Why React Native (bare workflow)

- Single TypeScript codebase ships Android + iOS simultaneously.
- Team can leverage existing JS/TS knowledge.
- `react-native-webrtc` is mature and battle-tested for VoIP.
- Native modules are writable in Kotlin/Java and Swift/ObjC when needed.
- Large ecosystem for dependencies (crypto, networking, storage).

### 2.2 Why bare workflow, not Expo Go

This project requires:
- Background services (message sync, call handling)
- Native modules for VPN/proxy integration (V2Ray on Android)
- Custom notification handling
- WebRTC with TURN

Expo Go cannot support any of these. Use bare workflow from day one.
Expo SDK is still acceptable for specific packages (`expo-notifications`,
`expo-secure-store`, `expo-local-authentication`) but the project is
not managed Expo.

### 2.3 iOS reality check

iOS is more restrictive than Android for background networking and VPN APIs.
The obfuscation approach differs per platform:

- **Android:** Run V2Ray as a background `VpnService` using `tun2socks`.
  All app traffic is transparently routed through the tunnel.
- **iOS:** Use `NEPacketTunnelProvider` for a similar VPN-based approach,
  OR rely on Cloudflare domain fronting + custom TLS at the application layer
  (simpler, less powerful). Start with domain fronting for iOS MVP;
  add `NEPacketTunnelProvider` in Phase 2.

---

## 3. Locked technology stack

Do not substitute these without a documented decision and team sign-off.

### 3.1 Application

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Framework | React Native (bare) | 0.76.x | Stable branch for current stack |
| Expo SDK (bare usage) | Expo | 52.x | Bare workflow with selected Expo modules |
| Language | TypeScript | 5.x strict mode | Type safety non-negotiable |
| Navigation | React Navigation | 6.x | Industry standard, well maintained |
| State management | Zustand | 4.x | Lightweight, no boilerplate |
| Async state / server | TanStack Query | 5.x | Caching, retry, offline |
| Local DB | WatermelonDB | latest | SQLite-backed, reactive, fast |
| Secure storage | `expo-secure-store` | 14.x | Keychain/Keystore backed |
| Push notifications | Firebase Cloud Messaging | via `@react-native-firebase/messaging` | Cross-platform |
| UI components | Custom design system | — | No UI library; build from scratch |
| Icons | `react-native-vector-icons` (Material) | latest | Lightweight |
| Animations | Reanimated 3 | 3.16.x | Expo SDK 52 compatibility line |

### 3.2 Communications

| Concern | Choice | Rationale |
|---|---|---|
| Messaging protocol | Matrix (via `matrix-js-sdk`) | E2EE, federated, offline queue built-in |
| Matrix homeserver | Conduit | Lighter than Synapse, Rust-based, fast |
| Audio codec | Opus (via WebRTC) | Best quality at low bitrate |
| Video codec | VP8 / H.264 adaptive | Degrades gracefully, wide hardware support |
| Real-time calls | `react-native-webrtc` | Best maintained RN WebRTC library |
| TURN server | Coturn | Self-hosted, open source |
| Signaling | Matrix rooms (built-in) | No separate signaling server needed |

### 3.3 Censorship bypass

| Concern | Choice | Platform |
|---|---|---|
| Domain fronting | Cloudflare (free) | Both Android + iOS |
| Traffic obfuscation | V2Ray VLESS+WebSocket | Android (native service) |
| iOS obfuscation (MVP) | Domain fronting only | iOS |
| iOS obfuscation (v2) | NEPacketTunnelProvider | iOS Phase 2 |
| TURN TCP fallback | Coturn on port 443 TCP | Both |

### 3.4 Backend infrastructure

| Service | Technology | Host | Est. cost |
|---|---|---|---|
| Matrix homeserver | Conduit | Hetzner CPX21 (EU) | €8.46/mo |
| TURN server | Coturn | Hetzner CX21 (secondary region) | €3.29/mo |
| Proxy/obfuscation | V2Ray + Nginx | Same as Conduit VPS | included |
| TLS/domain fronting | Cloudflare | Cloudflare free | €0 |
| Subscription DB | Supabase | AWS EU (Frankfurt) | Free → $25/mo |
| Media storage | Cloudflare R2 | Cloudflare | €0 (first 10GB) |
| Payments (global) | Stripe | — | 2.9% + 30¢ |
| Payments (Russia) | YooMoney / CloudPayments | — | ~3.5% |

### 3.5 Development tooling

| Tool | Purpose |
|---|---|
| pnpm | Package manager (faster than npm/yarn) |
| ESLint + Prettier | Code quality (strict config committed to repo) |
| Husky + lint-staged | Pre-commit hooks |
| Jest + Testing Library | Unit and component tests |
| Detox | E2E tests (Android + iOS) |
| Flipper | React Native debugging |
| Claude Code | AI-assisted development (primary tool) |

---

## 4. Repository structure

```
sauti/
├── src/
│   ├── app/                    # Root navigation, providers, app entry
│   │   ├── App.tsx
│   │   ├── RootNavigator.tsx
│   │   └── providers/          # All React context providers
│   │
│   ├── modules/                # Feature modules (colocated logic)
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   ├── store/          # Zustand slice
│   │   │   └── api/
│   │   ├── messaging/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   └── components/
│   │   ├── calling/
│   │   │   ├── screens/
│   │   │   ├── hooks/
│   │   │   └── webrtc/         # WebRTC logic isolated here
│   │   ├── contacts/
│   │   ├── subscription/
│   │   └── settings/
│   │
│   ├── core/                   # Shared infrastructure (no UI)
│   │   ├── matrix/             # Matrix client wrapper
│   │   │   ├── MatrixClient.ts
│   │   │   ├── MatrixSync.ts
│   │   │   └── MatrixCrypto.ts
│   │   ├── proxy/              # Censorship bypass layer
│   │   │   ├── ProxyManager.ts
│   │   │   └── DomainFronting.ts
│   │   ├── db/                 # WatermelonDB schema and models
│   │   │   ├── schema.ts
│   │   │   └── models/
│   │   ├── storage/            # AsyncStorage + SecureStore wrappers
│   │   ├── network/            # Network state, retry logic
│   │   └── crypto/             # Key management, encryption utils
│   │
│   ├── ui/                     # Design system (shared components)
│   │   ├── components/         # Button, Input, Avatar, etc.
│   │   ├── tokens/             # Colors, spacing, typography
│   │   └── hooks/              # useTheme, useKeyboard, etc.
│   │
│   └── utils/                  # Pure utility functions (no side effects)
│       ├── format.ts           # Date, number, string formatters
│       ├── compress.ts         # Image/media compression
│       └── validate.ts         # Input validation
│
├── android/                    # Android native project
│   └── app/src/main/java/
│       └── com/sauti/
│           ├── VpnService.kt   # V2Ray tunnel service
│           └── MainActivity.kt
│
├── ios/                        # iOS native project
│
├── native-modules/             # Shared native module specs
│   └── ProxyModule/            # V2Ray / tunnel abstraction
│
├── backend/                    # Backend config and scripts
│   ├── conduit/
│   │   └── conduit.toml        # Conduit config template
│   ├── coturn/
│   │   └── turnserver.conf     # Coturn config template
│   ├── nginx/
│   │   └── default.conf        # Nginx + V2Ray proxy config
│   └── scripts/
│       ├── setup-server.sh     # Full server setup script
│       └── deploy.sh
│
├── docs/
│   ├── MASTER_SPEC.md          # This document
│   ├── ADR/                    # Architecture decision records
│   └── api/                    # API documentation
│
├── .env.example                # Environment variable template
├── .eslintrc.js
├── tsconfig.json               # Strict TypeScript config
└── package.json
```

---

## 5. Environment variables

All secrets via environment variables. Never hardcode.

```bash
# .env.example

# Matrix homeserver
MATRIX_HOMESERVER_URL=https://matrix.yourdomain.com
MATRIX_HOMESERVER_DOMAIN=yourdomain.com

# V2Ray proxy (embedded in app, rotated periodically)
V2RAY_UUID=your-v2ray-uuid
V2RAY_PATH=/your-ws-path
V2RAY_HOST=yourdomain.com

# Cloudflare domain fronting
CF_FRONTING_HOST=cdn.cloudflare.com
CF_ORIGIN_HOST=matrix.yourdomain.com

# Coturn TURN server
TURN_SERVER_URL=turn:turn.yourdomain.com:443
TURN_SERVER_USERNAME=your-turn-user
TURN_SERVER_CREDENTIAL=your-turn-credential

# Supabase (subscriptions only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Firebase
GOOGLE_SERVICES_JSON=base64-encoded  # Android
GOOGLE_SERVICE_PLIST=base64-encoded  # iOS

# Payments
STRIPE_PUBLISHABLE_KEY=pk_live_...
YOOMONEY_SHOP_ID=your-shop-id
```

Use `react-native-config` to expose variables to JS.
Use `expo-secure-store` to cache sensitive runtime values.
Never commit `.env`. Commit `.env.example` with all keys, no values.

---

## 6. Core module specifications

### 6.1 Matrix client wrapper (`src/core/matrix/`)

The raw `matrix-js-sdk` is powerful but complex. Wrap it.

**Required polyfills (add to index.js before everything else):**
```js
// index.js — must be first
import 'react-native-get-random-values';    // crypto.getRandomValues
import 'react-native-url-polyfill/auto';    // URL
import { TextEncoder, TextDecoder } from 'text-encoding';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
```

**MatrixClient.ts responsibilities:**
- Initialise and expose a singleton Matrix client
- Handle login (password + SSO), logout, token refresh
- Abstract room creation and joining
- Emit typed events (do not expose raw SDK events to UI layer)
- Handle E2EE key backup and device verification
- Reconnect automatically after network loss with exponential backoff

**MatrixSync.ts responsibilities:**
- Manage the sync loop lifecycle (start/stop/pause for battery)
- Persist sync token to WatermelonDB so sync resumes from last position
- Debounce DB writes (batch updates, max 1 write per 200ms)
- Pause sync when app is backgrounded for >10 minutes

**Key rules:**
- Never import `matrix-js-sdk` outside `src/core/matrix/`. All Matrix access goes through the wrapper.
- All errors from Matrix must be caught and re-thrown as typed `sautiError` objects.
- Rooms = conversations. Do not use Matrix spaces or communities in v1.

**WatermelonDB models for messages:**
```ts
// src/core/db/models/Message.ts
class Message extends Model {
  static table = 'messages'
  @field('matrix_event_id') eventId!: string
  @field('room_id') roomId!: string
  @field('sender_id') senderId!: string
  @field('body') body!: string        // always store decrypted
  @field('msg_type') msgType!: string // m.text | m.image | m.audio
  @field('status') status!: 'sending' | 'sent' | 'delivered' | 'failed'
  @field('timestamp') timestamp!: number
  @field('is_read') isRead!: boolean
  @relation('rooms', 'room_id') room!: Relation<Room>
}
```

### 6.2 Proxy / censorship bypass (`src/core/proxy/`)

**ProxyManager.ts** is the single interface for all obfuscation logic.

```ts
interface ProxyManager {
  init(): Promise<void>
  getStatus(): ProxyStatus   // 'connected' | 'connecting' | 'failed' | 'disabled'
  getHttpsAgent(): https.Agent | null   // inject into matrix-js-sdk fetch
  isEnabled(): boolean
  enable(): Promise<void>
  disable(): Promise<void>
}
```

**Android implementation:**
- Uses a native Kotlin module (`ProxyModule.kt`) that starts a background `VpnService`
- The VPN service runs a local SOCKS5 proxy via V2Ray core embedded as a native library
- V2Ray config uses VLESS+WebSocket+TLS transport targeting your Cloudflare-proxied domain
- All device traffic is routed through the tunnel (system VPN mode)
- Fall back to direct connection if VPN setup fails (with user warning)

**iOS MVP implementation:**
- No system VPN (Phase 1)
- `DomainFronting.ts` creates a custom `https.Agent` with:
  - `servername` set to `cdn.cloudflare.com` (the fronting host)
  - Custom `Host` header set to your actual Matrix origin
- This agent is injected into matrix-js-sdk's `fetchFn` option
- Works for text messaging. For calls, TURN TCP:443 handles the bypass.

**Status indicator:** Always show proxy status in the UI. Users in Russia must
know if the tunnel is active. Use a coloured dot in the header (green/amber/red).

### 6.3 WebRTC / calling (`src/modules/calling/webrtc/`)

All WebRTC logic is isolated in `src/modules/calling/webrtc/`. Nothing outside this
directory should import from `react-native-webrtc` directly.

**CallManager.ts responsibilities:**
- Create and manage `RTCPeerConnection` instances
- Handle ICE candidate gathering and exchange via Matrix room events
- Manage call state machine: `idle → ringing → connecting → connected → ended`
- Implement TURN-first ICE policy (skip STUN in Russia, it's unreliable)
- Adaptive bitrate: monitor `RTCStatsReport` every 2s, adjust constraints
- Handle call resumption after network switch (WiFi → mobile data)

**ICE configuration (always use):**
```ts
const ICE_SERVERS = [
  {
    urls: [
      'turn:turn.yourdomain.com:443?transport=tcp',  // TCP:443 first (censorship bypass)
      'turn:turn.yourdomain.com:3478?transport=udp', // UDP fallback
    ],
    username: TURN_USERNAME,
    credential: TURN_CREDENTIAL,
  }
]

const PC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceTransportPolicy: 'relay',   // force TURN, never attempt direct P2P in Russia
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
}
```

**Bandwidth constraints by network quality:**
```ts
const QUALITY_PRESETS = {
  voice_only: {
    audio: { sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
    video: false,
  },
  video_low: {   // 2G / bad signal
    audio: { sampleRate: 16000 },
    video: { width: 144, height: 176, frameRate: 10, facingMode: 'user' },
  },
  video_medium: { // 3G
    audio: { sampleRate: 48000 },
    video: { width: 320, height: 240, frameRate: 15, facingMode: 'user' },
  },
  video_high: {   // 4G / WiFi
    audio: { sampleRate: 48000 },
    video: { width: 640, height: 480, frameRate: 24, facingMode: 'user' },
  },
}
```

**Signaling via Matrix:** Use Matrix `m.call.*` events (MSC2746 protocol).
Do not implement custom signaling. This is already part of the Matrix spec.

### 6.4 Offline message queue

Messages typed while offline must never be lost.

**Flow:**
1. User sends message → immediately write to WatermelonDB with `status: 'sending'`
2. Show in UI immediately (optimistic update)
3. Attempt Matrix send in background
4. On success: update `status: 'sent'`, store `matrix_event_id`
5. On failure: keep `status: 'sending'`, add to retry queue
6. Retry queue processes on every network-restored event with exponential backoff
7. After 72 hours without delivery, mark `status: 'failed'` and notify user

**Network state monitoring:**
```ts
// src/core/network/NetworkMonitor.ts
// Uses @react-native-community/netinfo
// Emits: 'connected' | 'disconnected' | 'degraded' (< 100kbps)
// All modules subscribe to this, not to NetInfo directly
```

### 6.5 Subscription & payments (`src/modules/subscription/`)

**Business logic:** One subscription covers the subscriber plus all their contacts.
If Alice pays, Alice can invite Bob. Bob does not need to pay to communicate with Alice.
Bob needs his own subscription to initiate contact with Carol.

**Subscription check flow:**
1. On login, fetch subscription status from Supabase
2. Cache status in `expo-secure-store` with 24h TTL
3. On app open, check cache first (avoid network on every open)
4. Matrix account is created regardless of subscription status
5. Subscription gate: sending messages to non-contacts requires active subscription
   (receiving messages always works — never block incoming)

**Supabase schema (subscriptions table):**
```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  matrix_user_id text not null unique,  -- @user:yourdomain.com
  plan text not null default 'free',    -- 'free' | 'family'
  status text not null default 'active', -- 'active' | 'expired' | 'cancelled'
  price_rub integer,                    -- 199
  payment_provider text,                -- 'stripe' | 'yoomoney'
  current_period_end timestamptz,
  created_at timestamptz default now()
);
```

**Payment providers:**
- Stripe: for Africa-side payments. Use Stripe's Payment Sheet (native SDK).
  Supports Mpesa (Kenya), cards, etc. via Stripe's Africa integrations.
- YooMoney/CloudPayments: for Russia-side. Use WebView-based payment flow
  as these don't have official React Native SDKs. Verify via webhook to Supabase.

---

## 7. Screen specifications

### 7.1 Onboarding flow

```
SplashScreen (logo + proxy init)
  └─ if first launch → OnboardingCarousel (3 slides)
       └─ PhoneNumber entry
            └─ OTP verification (via Matrix email or custom auth)
                 └─ ProfileSetup (display name + avatar)
                      └─ MainApp
  └─ if returning → ProxyConnecting (show status)
       └─ MainApp (if token valid)
       └─ Login (if token expired)
```

### 7.2 Main tab navigator

Four tabs. Keep it simple.

| Tab | Icon | Screen |
|---|---|---|
| Chats | chat-bubble | ConversationList |
| Calls | phone | CallLog |
| Contacts | people | ContactList |
| Settings | settings | SettingsRoot |

### 7.3 ConversationList screen

- Show all direct-message rooms, sorted by latest message timestamp
- Each row: avatar, display name, last message preview (max 1 line), timestamp, unread badge
- Swipe-left to archive / mute
- Tap floating action button → NewConversation (contact search)
- Connection status banner at top (green/amber/red proxy indicator)
- Offline indicator banner when no network

### 7.4 ChatRoom screen

- Message bubbles (outgoing right, incoming left)
- Message status icons: clock (sending), single tick (sent), double tick (delivered), blue double tick (read)
- Long-press message → react / copy / delete / forward
- Input bar: text input + attachment icon + send button
  - Attachment: camera, gallery, voice note (no file picker in v1)
- Voice note: hold-to-record, slide to cancel, release to send
- Media: images shown inline (compressed, tap to expand). Files shown as download card.
- Auto-scroll to bottom on new incoming message (unless user has scrolled up)

**Performance requirement:** Render 500 messages without jank.
Use WatermelonDB's `observe()` with React Native's `FlatList`.
Paginate: load last 50, fetch more on scroll-up.

### 7.5 CallScreen

- Full-screen during active call
- Show: remote video (large), local video (PiP, draggable)
- Controls: mute, camera on/off, flip camera, end call, speaker
- Network quality indicator (1–5 bars based on RTCStats)
- If video call on poor network: auto-suggest switching to voice only
- Incoming call: show over lock screen (use `react-native-callkeep`)

### 7.6 Settings screen

Key settings to implement:

- **Privacy & Security**
  - Active sessions (list Matrix device sessions, ability to revoke)
  - App lock (biometric / PIN via `expo-local-authentication`)
  - Auto-delete messages (7d / 30d / never)

- **Connection**
  - Proxy status and toggle
  - Manual proxy config (advanced users)
  - Download media automatically (toggle, default: WiFi only)

- **Subscription**
  - Current plan and expiry
  - Manage subscription (opens payment sheet)
  - Billing history

- **Notifications**
  - Per-conversation mute
  - Preview content in notification (toggle)

---

## 8. Security requirements

These are non-negotiable. Every relevant task in Claude Code must reference this section.

### 8.1 Encryption

- All messages use Matrix's Olm/Megolm E2EE. Never disable. Never send unencrypted rooms.
- Enable cross-signing for device verification. Prompt users to verify new devices.
- Store Matrix auth token and device keys in `expo-secure-store` (Keychain on iOS, Keystore on Android). Never AsyncStorage for credentials.
- Key backup: use SSSS (Secure Secret Storage and Sharing) with a recovery passphrase. Prompt setup on first login.
- Media files: encrypt before upload to Cloudflare R2 (Matrix does this via `m.file` encrypted attachment spec). Never upload plaintext media.

### 8.2 Transport

- All connections TLS 1.2+. Pin the Cloudflare root CA for the fronted connections.
- V2Ray config: VLESS + WebSocket + TLS. No plain VLESS or unencrypted transport.
- Never fall back to unencrypted HTTP. If HTTPS fails, show error; do not retry on HTTP.
- TURN credentials: use time-limited HMAC credentials (Coturn supports this).
  Credentials expire every 24 hours. Rotate via API call to Supabase edge function.

### 8.3 Local data

- WatermelonDB stores decrypted message bodies. The device is the trust boundary.
- Implement app lock: after 3 failed PIN/biometric attempts, wipe local cache (not account).
- On logout: wipe all local WatermelonDB tables, clear SecureStore, revoke Matrix session.
- Screenshot prevention: use `react-native-screenshot-prevent` for ChatRoom and CallScreen.

### 8.4 The proxy UUID / path

- V2Ray UUID and WebSocket path are embedded in the app binary but obfuscated.
- Do not log these values. Do not include them in crash reports.
- Rotate every 90 days. Old config continues working for 7 days post-rotation (migration window).
- The rotation endpoint is a Supabase edge function that returns new config only to authenticated, subscribed users.

### 8.5 What to never do

- Never log Matrix event IDs, room IDs, or message bodies to any external service.
- Never use Sentry, Datadog, or any crash reporter that might capture message content.
  Use a self-hosted Sentry instance or strip all sensitive data before reporting.
- Never store credentials in React Native `AsyncStorage` (it is unencrypted).
- Never make the proxy optional in Russia. If proxy fails, warn user; do not silently fall back to direct connection that would expose traffic to DPI.

---

## 9. Performance requirements

| Metric | Target | How to measure |
|---|---|---|
| Cold start (Android mid-range) | < 3s to interactive | Flipper startup profiler |
| Message send latency (online) | < 500ms to sent status | Timestamp in store |
| Message render (500 items) | No frame drops > 16ms | FlatList + Reanimated profiler |
| Voice call setup time | < 5s to connected | ICE gathering timer |
| Audio latency (end-to-end) | < 200ms | WebRTC stats |
| App size (install) | < 50MB | Bundle analysis |
| Memory usage (idle) | < 80MB | Android Profiler |

### 9.1 Image handling

All images must be compressed before display and before send.

```ts
// src/utils/compress.ts
// Use react-native-image-resizer
// Inbound: resize to max 1280px, quality 75, format JPEG
// Outbound: resize to max 1280px, quality 70, format JPEG
// Thumbnails: 200px, quality 60
// Voice notes: Opus codec, 16kbps mono (via react-native-audio-recorder-player)
```

Manual download mode: when `settings.autoDownloadMedia === 'wifi_only'`,
show a download button for images/voice on mobile data. Never auto-load.

---

## 10. Backend setup guide

### 10.1 Conduit (Matrix homeserver)

Install on Hetzner CPX21 (Ubuntu 22.04):

```bash
# Install Conduit
wget https://github.com/famedly/conduit/releases/latest/download/conduit-x86_64-linux-musl
chmod +x conduit-x86_64-linux-musl
mv conduit-x86_64-linux-musl /usr/local/bin/conduit

# Key conduit.toml settings
[global]
server_name = "yourdomain.com"
database_backend = "rocksdb"
max_request_size = 20_000_000   # 20MB upload limit
allow_registration = false       # registration via API only (subscription-gated)
allow_federation = false         # disable federation — private network only
```

### 10.2 Coturn

```bash
apt install coturn

# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
alt-listening-port=443       # critical: TCP:443 for censorship bypass
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=YOUR_LONG_RANDOM_SECRET
realm=turn.yourdomain.com
total-quota=100
no-stdout-log
syslog
```

### 10.3 Nginx + V2Ray

```nginx
# /etc/nginx/sites-enabled/default
server {
  listen 443 ssl;
  server_name yourdomain.com;
  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  # V2Ray WebSocket path (keep secret)
  location /YOUR_SECRET_PATH {
    proxy_pass http://127.0.0.1:10086;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  # Matrix /_matrix path
  location /_matrix {
    proxy_pass http://127.0.0.1:6167;
    proxy_set_header X-Forwarded-For $remote_addr;
    client_max_body_size 20M;
  }
}
```

### 10.4 User registration flow (subscription-gated)

Since `allow_registration = false` in Conduit, create a Supabase Edge Function
that acts as a registration proxy:

1. User completes phone verification in app
2. App calls Supabase Edge Function `/register-matrix-user`
3. Edge function creates Matrix account via Conduit admin API
4. Returns Matrix credentials to app
5. App logs in to Matrix

This gives you full control over who gets an account.

---

## 11. Build phases

### Phase 1 — Messaging MVP (target: 8 weeks)

Goal: Two people can exchange encrypted text messages, even from Russia.

- [ ] Bare RN project setup with full TypeScript config
- [ ] Design system tokens + 5 core components (Button, Input, Avatar, MessageBubble, Screen)
- [ ] Auth flow (phone + OTP → Matrix account creation)
- [ ] Matrix client wrapper with offline sync
- [ ] WatermelonDB models + migration setup
- [ ] ConversationList + ChatRoom screens
- [ ] Offline queue with retry
- [ ] Push notifications (FCM)
- [ ] Domain fronting proxy (iOS + Android)
- [ ] Android V2Ray VPN service (native module)
- [ ] Conduit + Nginx + V2Ray server setup
- [ ] Supabase subscriptions schema + registration edge function

**Not in Phase 1:** Video calls, payments, media attachments, voice notes

### Phase 2 — Voice & video calling (target: weeks 9–14)

- [ ] react-native-webrtc integration
- [ ] CallManager with Matrix signaling
- [ ] Coturn TURN server (TCP:443)
- [ ] IncomingCall screen with react-native-callkeep
- [ ] CallScreen with adaptive quality
- [ ] Voice notes in chat
- [ ] Image send/receive with compression
- [ ] iOS NEPacketTunnelProvider (obfuscation v2)

### Phase 3 — Subscriptions & growth (target: weeks 15–20)

- [ ] Stripe payment integration
- [ ] YooMoney / CloudPayments integration
- [ ] Family plan logic (invite contacts)
- [ ] Subscription gate in UI
- [ ] App Store + Play Store submission
- [ ] Self-hosted Sentry for crash reporting
- [ ] Admin dashboard (Supabase Studio + custom views)

---

## 12. Claude Code usage guide

### 12.1 Session setup

Start every Claude Code session with:

```
You are helping build sauti, a censorship-resistant messaging app.
Key constraints:
- React Native bare workflow, TypeScript strict mode
- All Matrix access through src/core/matrix/ wrapper only
- All secrets via react-native-config, never hardcoded
- expo-secure-store for all credentials, never AsyncStorage
- See MASTER_SPEC.md for full context

Current task: [describe task]
Relevant spec section: [paste section number and content]
```

### 12.2 Module-specific prompts

**For a new screen:**
```
Create the [ScreenName] screen following the spec in section 7.x.
Location: src/modules/[module]/screens/[ScreenName].tsx
Use the existing design system tokens from src/ui/tokens/.
Use Zustand from src/modules/[module]/store/ for state.
Do not import from matrix-js-sdk directly.
```

**For a new core module:**
```
Create the [ModuleName] module in src/core/[module]/.
It must export a singleton instance.
All errors must be typed sautiError from src/core/errors.ts.
Write a Jest unit test alongside the implementation.
```

**For native module work:**
```
This requires native Android/iOS code.
Android: Kotlin in android/app/src/main/java/com/sauti/
iOS: Swift in ios/sauti/
The JS interface lives in src/core/proxy/ProxyModule.ts.
Use the NativeModule bridge pattern, not TurboModules (for now).
```

### 12.3 Code quality gates

Before marking any task complete, ensure:

- [ ] No TypeScript `any` types (use `unknown` + type guard if truly unknown)
- [ ] No raw `console.log` (use the logger utility in `src/utils/logger.ts`)
- [ ] No direct `AsyncStorage` for credentials (must be `SecureStore`)
- [ ] No imports of `matrix-js-sdk` outside `src/core/matrix/`
- [ ] No hardcoded strings visible to users (i18n-ready keys)
- [ ] Error states handled (network fail, permission denied, etc.)
- [ ] Loading states handled (skeleton or spinner)
- [ ] Component has basic Jest test

### 12.4 Git workflow

```
main          ← production (protected, requires PR + review)
staging       ← pre-release testing
dev           ← integration branch

feature/[initials]-[short-description]   ← feature branches
fix/[initials]-[short-description]       ← bug fixes
```

Commit message format: `type(scope): description`
Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`
Example: `feat(messaging): add voice note recording to chat input`

---

## 13. Key risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| matrix-js-sdk polyfill issues on RN | High | High | Prototype this in week 1 before building anything else |
| Russia blocks V2Ray signatures | Medium | High | Use XTLS-Vision or Hysteria2 as fallback; keep configs rotatable |
| App Store rejection (iOS) | Medium | Medium | Do not mention circumvention in metadata; position as "reliable messaging for international students" |
| TURN relay costs spike | Low | Medium | Enforce max bitrate per call; monitor with Coturn stats |
| YooMoney/CloudPayments integration complexity | High | Low | Budget 2 weeks for this; use WebView fallback if SDK is unavailable |
| matrix-js-sdk E2EE setup complexity | High | Medium | Use the official matrix-react-sdk encryption setup guide; allocate week 2 entirely to this |

---

*Document version 1.0 — update this file when architecture decisions change.*
*All changes to section 3 (locked stack) require team sign-off and an ADR entry.*