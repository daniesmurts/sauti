# Sauti Master Checklist

Source of truth: masterSpec.md
Last updated: 2026-04-10
Status basis: current implementation in SautiApp plus targeted regression coverage for recent messaging/contacts work

Tag legend:
- DONE: Implemented and validated against acceptance criteria.
- PARTIAL: Some implementation exists, but acceptance criteria are not fully met.
- BLOCKED: Cannot complete inside this repo alone, or depends on external infra/platform/legal constraints.
- TODO: Not started.

Closure rule:
- An item can be moved to DONE only when all acceptance criteria are checked and at least one validating test (unit/integration/e2e as appropriate) exists.

---

## Review Delta - 2026-04-10

Recent completed work:
- [x] Unified single-container app navigation is in place with Chats, Calls, Contacts, and Settings tabs.
- [x] Consumer-style chat start flow exists with friendly-input resolution plus Advanced raw Matrix target entry.
- [x] Ambiguous contact/name matches now route to explicit disambiguation instead of silently opening the wrong chat.
- [x] Local contacts persistence now exists via WatermelonDB contacts schema, migration, model, store, and runtime gateway.
- [x] Contacts tab is wired into the shared chat-start flow and recent targeted regression suites are passing.

Open review risks from current implementation:
- [x] New Chat now stays mounted until async raw-target creation succeeds, and start failures remain visible inline.
- [x] Repeating the same contact handoff is now handled via request IDs rather than raw-string dedupe.
- [x] Contact row taps now pass stable room/contact identifiers through the shared resolver.
- [x] Contacts persistence now stores richer metadata with merge rules for Matrix IDs, phone numbers, and source priority.

---

## Phase 1 - Messaging MVP

### 1) Bare RN project setup with full TypeScript config
Tag: DONE
Acceptance criteria:
- [x] React Native bare app builds for Android and iOS.
- [x] TypeScript strict mode is enabled.
- [x] pnpm is primary package manager (lockfile present).
- [x] Jest test command runs successfully.

### 2) Design system tokens + 5 core components (Button, Input, Avatar, MessageBubble, Screen)
Tag: DONE
Acceptance criteria:
- [x] Shared tokens exist for colors, spacing, typography.
- [x] All 5 components implemented under ui/components.
- [x] Component tests exist and pass.

### 3) Auth flow (phone + OTP -> Matrix account creation)
Tag: PARTIAL
Acceptance criteria:
- [x] Phone and OTP screens implemented.
- [x] Auth flow state transitions implemented and tested.
- [x] Registration service calls Supabase edge endpoint.
- [ ] Production-grade OTP verification provider is integrated end-to-end.
- [x] Profile setup step (display name/avatar) is implemented per spec flow.

### 4) Matrix client wrapper with offline sync
Tag: DONE
Acceptance criteria:
- [x] matrix-js-sdk usage isolated to core/matrix.
- [x] Runtime wrapper handles init/start/stop/recovery.
- [x] MatrixSync implemented with token persistence and debounce behavior.
- [x] E2EE bootstrap and key backup hooks exist.
- [x] Unit tests cover wrapper and lifecycle behavior.

### 5) WatermelonDB models + migration setup
Tag: DONE
Acceptance criteria:
- [x] Schema exists for rooms, messages, outgoing_messages, and contacts.
- [x] Model classes exist.
- [x] Migration scaffold exists.
- [x] Repository adapters exist and are tested.

### 6) ConversationList + ChatRoom screens
Tag: PARTIAL
Acceptance criteria:
- [x] Conversation list renders room rows with unread and metadata.
- [x] Chat room renders messages and send input.
- [x] Runtime-backed loading/sending is wired through gateway.
- [x] Swipe archive/mute actions implemented.
- [x] FAB to NewConversation with contact search implemented.
- [x] Connection status banner and offline banner shown in list UI.
- [x] Main app navigation uses Chats, Calls, Contacts, and Settings tabs.
- [x] Contacts tab and New Chat share the same name-first chat-start resolver.
- [x] Ambiguous matches are surfaced with an explicit picker instead of silent auto-selection.
- [x] Starting a brand new raw-target chat keeps the user on-screen until success/failure is known.
- [x] Tapping a contact row resolves via a stable identifier instead of display-name text.
Validation note: recent contacts-first, local-contact persistence, and chat-start UX regression coverage are green; remaining work is now mainly richer contacts metadata and real-device validation.
Validation note: recent contacts-first, local-contact persistence, richer contact metadata, and chat-start UX regression coverage are green; remaining work is now mainly real-device validation and infra documentation.

### 7) Offline queue with retry
Tag: DONE
Acceptance criteria:
- [x] Optimistic send path writes pending message.
- [x] Retry queue with exponential backoff exists.
- [x] Network monitor integration triggers retries on reconnect.
- [x] 72h failure window behavior implemented.
- [x] Tests validate queue lifecycle and retry behavior.

### 8) Push notifications (FCM)
Tag: DONE
Acceptance criteria:
- [x] FCM dependency is installed.
- [x] Device token fetch flow implemented in core notification service.
- [x] Foreground and background handlers plumbing implemented.
- [x] Notification permission request flow implemented.
- [x] Push-triggered deep link/open behavior implemented.

### 9) Domain fronting proxy (iOS + Android)
Tag: PARTIAL
Acceptance criteria:
- [x] Proxy abstraction exists.
- [x] Domain fronting fetch strategy exists in app layer.
- [x] Runtime can surface proxy status.
- [x] UI displays explicit proxy status indicator banner/dot for users.
- [ ] Android domain fronting plus VPN path validated together in real device conditions.
Validation note: device test procedure is documented in README; live Android execution remains pending.

### 10) Android V2Ray VPN service (native module)
Tag: PARTIAL
Acceptance criteria:
- [x] Native Android VpnService scaffold implemented.
- [x] JS bridge module for enable/disable/status implemented.
- [x] Tunnel lifecycle scaffold integrated with ProxyManager with resilient fallback.
- [x] Failure fallback path with explicit user warning implemented.
- [ ] Device-level validation test plan documented and executed.
Validation note: diagnostics surface (`getDiagnostics`) and device test procedure are now in-repo; actual device execution is still pending.

### 11) Conduit + Nginx + V2Ray server setup
Tag: PARTIAL
Why partially blocked:
- VPS is provisioned and core services are live. Remaining close-out is app-level smoke validation through the proxy path.
Acceptance criteria:
- [x] Backend config templates committed (conduit.toml, turnserver.conf, nginx, v2ray).
- [x] Setup/deploy scripts committed and reviewed.
- [x] setup-server.sh executed on a live Ubuntu 22.04 VPS with real domain.
- [x] Matrix admin token obtained and set as Supabase secret (MATRIX_PROVISIONING_API_TOKEN).
- [x] Smoke subchecks passed: `/_matrix/client/versions` healthy, Matrix login/createRoom/send validated via API.
- [ ] Smoke test passed: curl /_matrix/client/versions, register user, send message through proxy.

### 12) Supabase subscriptions schema + registration edge function
Tag: DONE
Acceptance criteria:
- [x] Client calls expected edge endpoints (register-matrix-user, subscription-status).
- [x] Subscription cache with TTL in SecureStore implemented.
- [x] SQL schema migrations committed in repository.
- [x] Edge function implementations committed and tested.
- [x] Webhook or provider sync path documented.

---

## Phase 2 - Voice and Video Calling

### 1) react-native-webrtc integration
Tag: DONE
Acceptance criteria:
- [x] Dependency installed and initialized.
- [x] RN platform setup complete for Android/iOS.
- [x] Basic peer connection smoke test passes.

### 2) CallManager with Matrix signaling
Tag: DONE
Acceptance criteria:
- [x] Call state machine implemented.
- [x] m.call signaling integrated via Matrix events.
- [x] TURN-first ICE policy enforced.
- [x] Unit tests for call state transitions.

### 3) Coturn TURN server (TCP:443)
Tag: BLOCKED
Why blocked:
- Requires server provisioning and external infrastructure setup.
Acceptance criteria:
- [ ] Turn config committed.
- [ ] Credential rotation strategy implemented.
- [ ] Connectivity tests documented for Russia-side constraints.

### 4) IncomingCall screen with react-native-callkeep
Tag: DONE
Acceptance criteria:
- [x] Incoming call UI implemented.
- [x] Lock-screen presentation works on Android/iOS.
- [x] Accept/decline actions wired to signaling.

### 5) CallScreen with adaptive quality
Tag: DONE
Acceptance criteria:
- [x] Full call controls implemented.
- [x] Network quality indicator implemented.
- [x] Auto-suggest downgrade to voice on poor stats.

### 6) Voice notes in chat
Tag: DONE
Acceptance criteria:
- [x] Hold-to-record and slide-to-cancel interactions implemented.
- [x] Encoded output and upload flow implemented.
- [x] Playback bubble UI implemented.

### 7) Image send/receive with compression
Tag: DONE
Acceptance criteria:
- [x] Compression utility integrated for outbound images.
- [x] Inline image rendering with tap-to-expand implemented.
- [x] Manual download behavior respects connection setting.

### 8) iOS NEPacketTunnelProvider (obfuscation v2)
Tag: BLOCKED
Why blocked:
- Requires iOS network extension entitlement, Apple provisioning, and native implementation work.
Acceptance criteria:
- [ ] Network extension target created and configured.
- [ ] Tunnel provider start/stop/status integrated to app.
- [ ] App review and entitlement documentation prepared.

---

## Phase 3 - Subscriptions and Growth

### 1) Tbank online payments integration (PCI DSS)
Tag: DONE
Acceptance criteria:
- [x] Native card form with RSA-encrypted card data implemented.
- [x] Full Init → Check3DSVersion → FinishAuthorize → 3DS WebView → GetState flow implemented.
- [x] Tbank notification webhook verified and subscription activation path validated.
- [x] Error/retry UX completed.

### 3) Family plan logic (invite contacts)
Tag: DONE
Acceptance criteria:
- [x] Invite and entitlement model implemented.
- [x] Access checks applied consistently.
- [x] Tests cover payer/invitee scenarios.

### 4) Subscription gate in UI
Tag: DONE
Acceptance criteria:
- [x] Gate rules implemented for initiating non-contact messages.
- [x] Receiving messages remains unrestricted.
- [x] Clear upgrade prompts and states implemented.

### 5) App Store + Play Store submission
Tag: BLOCKED
Why blocked:
- Requires release accounts, signing, policy copy, assets, and CI release process.
Acceptance criteria:
- [ ] Release build pipeline exists.
- [ ] Store metadata and policy disclosures completed.
- [ ] Internal testing rollout completed.

### 6) Self-hosted Sentry for crash reporting
Tag: TODO
Acceptance criteria:
- [ ] Self-hosted telemetry stack selected and configured.
- [ ] Sensitive-data scrubbing policy enforced.
- [ ] App integration tested with redaction checks.

### 7) Admin dashboard (Supabase Studio + custom views)
Tag: BLOCKED
Why blocked:
- Requires backend ownership and operations scope outside current mobile repo.
Acceptance criteria:
- [ ] Admin view requirements documented.
- [ ] Read/write permissions model enforced.
- [ ] Operational runbook committed.

---

## Cross-cutting Security and Quality Gates

### Security hard requirements
Tag: PARTIAL
Acceptance criteria:
- [x] SecureStore used for credentials and sensitive caches.
- [x] Matrix wrapper and typed error paths established.
- [x] Screenshot prevention enabled for chat and call screens.
- [ ] TLS pinning implemented for fronted transport.
- [ ] Device/session management UX completed.

### Performance requirements
Tag: PARTIAL
Acceptance criteria:
- [x] Core architecture supports pagination/offline queue foundation.
- [ ] Cold-start benchmark evidence recorded (<3s target).
- [ ] 500-message render benchmark evidence recorded.
- [ ] Voice setup/latency metrics recorded (post-calling implementation).

---

## Immediate Next Closure Sequence

1. [ ] Execute real-device proxy/VPN validation for Android domain fronting plus V2Ray together and record the result in repo documentation.
2. [ ] Add backend artifacts in-repo or link an infra repo with pinned commit references and deployment runbook.
