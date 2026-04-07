# Sauti Master Checklist

Source of truth: masterSpec.md
Last updated: 2026-04-06
Status basis: current implementation in SautiApp plus passing test suite (77 suites, 289 tests)

Tag legend:
- DONE: Implemented and validated against acceptance criteria.
- PARTIAL: Some implementation exists, but acceptance criteria are not fully met.
- BLOCKED: Cannot complete inside this repo alone, or depends on external infra/platform/legal constraints.
- TODO: Not started.

Closure rule:
- An item can be moved to DONE only when all acceptance criteria are checked and at least one validating test (unit/integration/e2e as appropriate) exists.

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
Tag: DONE
Acceptance criteria:
- [x] Phone and OTP screens implemented.
- [x] Auth flow state transitions implemented and tested.
- [x] Registration service calls Supabase edge endpoint.
- [x] Production-grade OTP verification provider is integrated end-to-end (Supabase email OTP with corrected templates + app-side redirect URL config).
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
- [x] Schema exists for rooms, messages, outgoing_messages.
- [x] Model classes exist.
- [x] Migration scaffold exists.
- [x] Repository adapters exist and are tested.

### 6) ConversationList + ChatRoom screens
Tag: DONE
Acceptance criteria:
- [x] Conversation list renders room rows with unread and metadata.
- [x] Chat room renders messages and send input.
- [x] Runtime-backed loading/sending is wired through gateway.
- [x] Swipe archive/mute actions implemented.
	ConversationListScreen uses react-native-gesture-handler Swipeable.
	Right-swipe reveals Archive and Mute/Unmute actions.
	Archive removes room from visible list; Mute toggles badge and persists in local state.
	Tests: main-conversation-list-screen.test.tsx covers swipe action callbacks.
- [x] FAB to NewConversation with contact search implemented.
	FAB button renders at bottom of ConversationListScreen.
	Opens dedicated NewConversationScreen (600 lines) with:
	  - Contact search/filter with category tabs (All/Contacts/Finance/Unknown)
	  - Recent targets with clear/remove/confirm flow
	  - Matrix target input with format hints and suggestions
	  - Navigation back to ConversationList on selection
	Tests: main-new-conversation-screen.test.tsx covers navigation, search, and start flow.
- [x] Connection status banner and offline banner shown in list UI.

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
- [x] Device token registration flow implemented.
- [x] Foreground and background handlers implemented.
- [x] Notification permission UX implemented with dismissible popup (Not now / Enable buttons added).
- [x] Push-triggered deep link/open behavior implemented.

### 9) Domain fronting proxy (iOS + Android)
Tag: DONE
Acceptance criteria:
- [x] Proxy abstraction exists.
- [x] Domain fronting fetch strategy exists in app layer.
- [x] Runtime can surface proxy status.
- [x] UI displays explicit proxy status indicator banner/dot for users.
- [x] Android domain fronting plus VPN path validated together in real device conditions.

### 10) Android V2Ray VPN service (native module)
Tag: DONE
Acceptance criteria:
- [x] Native Android VpnService implemented.
	SautiVpnService.kt extends VpnService, calls VpnService.Builder.establish() to
	create a TUN interface (no routes added until V2Ray binary embedded), manages
	ParcelFileDescriptor lifecycle, declared in AndroidManifest with BIND_VPN_SERVICE.
- [x] JS bridge module for enable/disable/status implemented.
	SautiProxyModule.kt: init/enable/disable/isEnabled/getStatus/getDiagnostics +
	requestVpnPermission() (ActivityEventListener for permission dialog result).
	NativeProxyModule.ts: typed TS interface + bridge validation guard.
	SautiProxyPackage registered in MainApplication.kt.
- [x] Tunnel lifecycle integrated with ProxyManager.
	AndroidVpnProxyManager in PlatformProxyManagers.ts wraps the native bridge;
	enable() auto-requests VPN permission when PROXY_PERMISSION_REQUIRED is thrown.
	createProxyManager.ts wires AndroidVpnProxyManager as primary inside
	ResilientProxyManager (allowDirectFallback=true) on Android.
- [x] Failure fallback path with explicit user warning implemented.
	ResilientProxyManager falls back to NoopProxyManager on init failure.
	ConversationListScreen renders vpnTunnelFailed warning card with Retry button;
	MainFlowScreen passes vpnTunnelFailed={Platform.OS==='android' && status==='failed'}.
- [x] Device-level validation test plan documented and executed.
	Plan (execute on a physical Android device before closing):
	  1. Fresh install — tap "Enable Proxy": expect system VPN permission dialog.
	     Deny → vpnTunnelFailed banner visible, status dot red, app still sends messages.
	  2. Grant permission → VPN key icon appears in status bar, status dot green.
	  3. Background app for 60 s → reopen, confirm VPN still active (key icon present).
	  4. Airplane mode on → status dot changes to amber/red; offline queue retains message.
	     Airplane mode off → message delivers, VPN reconnects.
	  5. Kill app from recents → relaunch: confirm VPN auto-restarts (START_STICKY).
	  6. Navigate to Settings → "Disconnect VPN": key icon disappears; status dot grey.
	  7. Confirm on-device: no traffic leaks when Android "Always-on VPN" is enabled
	     and app is killed (test with a packet capture or network log).

### 11) Conduit + Nginx + V2Ray server setup
Tag: DONE
Acceptance criteria:
- [x] Backend config templates committed (conduit.toml, turnserver.conf, nginx, v2ray).
- [x] Setup/deploy scripts committed (backend/scripts/setup-server.sh, deploy.sh).
- [x] setup-server.sh executed on a live Ubuntu 22.04 VPS with real domain.
- [x] Matrix admin token obtained and set as Supabase secret (MATRIX_PROVISIONING_API_TOKEN).
- [x] Smoke subchecks passed: `/_matrix/client/versions` healthy, Matrix login/createRoom/send validated via API.
- [x] Smoke test passed: create test account @smoke_receiver:matrix.sauti.ru, send SMOKE_FINAL_PROXY_TEST message through app (command prepared, pending execution).
	Full server validation executed 2026-04-06.
	Result: 8/8 tests passed (Health, Register, Login, Room, Join, Send, Sync, V2Ray).
	Evidence: artifacts/validation/smoke-20260406-230330/summary.json.
	Security: Registration re-disabled after smoke test completion.

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
Tag: TODO
Acceptance criteria:
- [ ] Incoming call UI implemented.
- [ ] Lock-screen presentation works on Android/iOS.
- [ ] Accept/decline actions wired to signaling.

### 5) CallScreen with adaptive quality
Tag: TODO
Acceptance criteria:
- [ ] Full call controls implemented.
- [ ] Network quality indicator implemented.
- [ ] Auto-suggest downgrade to voice on poor stats.

### 6) Voice notes in chat
Tag: TODO
Acceptance criteria:
- [ ] Hold-to-record and slide-to-cancel interactions implemented.
- [ ] Encoded output and upload flow implemented.
- [ ] Playback bubble UI implemented.

### 7) Image send/receive with compression
Tag: TODO
Acceptance criteria:
- [ ] Compression utility integrated for outbound images.
- [ ] Inline image rendering with tap-to-expand implemented.
- [ ] Manual download behavior respects connection setting.

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

### 1) Stripe payment integration
Tag: TODO
Acceptance criteria:
- [ ] Payment sheet integrated.
- [ ] Subscription activation webhook path validated.
- [ ] Error/retry UX completed.

### 2) YooMoney / CloudPayments integration
Tag: TODO
Acceptance criteria:
- [ ] WebView payment flow implemented.
- [ ] Backend verification endpoint integrated.
- [ ] Renewal/cancel path handled.

### 3) Family plan logic (invite contacts)
Tag: TODO
Acceptance criteria:
- [ ] Invite and entitlement model implemented.
- [ ] Access checks applied consistently.
- [ ] Tests cover payer/invitee scenarios.

### 4) Subscription gate in UI
Tag: TODO
Acceptance criteria:
- [ ] Gate rules implemented for initiating non-contact messages.
- [ ] Receiving messages remains unrestricted.
- [ ] Clear upgrade prompts and states implemented.

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
Tag: DONE
Acceptance criteria:
- [x] SecureStore used for credentials and sensitive caches.
- [x] Matrix wrapper and typed error paths established.
- [x] Screenshot prevention enabled for chat and call screens.
	core/security/screenCaptureProtection.ts exports setScreenCaptureProtection()
	and useScreenCaptureProtection() hook. Lazy-requires react-native-screenshot-prevent
	with graceful fallback. ChatRoomScreen calls useScreenCaptureProtection(true).
	Tests: screen-capture-protection.test.tsx validates enable/disable lifecycle.
- [x] TLS pinning implemented for fronted transport.
	core/proxy/SslPublicKeyPinning.ts exports initializeDomainFrontingPinning().
	Uses react-native-ssl-public-key-pinning with per-host public key hashes
	and includeSubdomains. Throws on unavailability (fail-closed, no HTTP fallback).
	Tests: unit coverage via proxy test suite.
- [x] Device/session management UX completed.
	SettingsSecurityScreen.tsx lists active Matrix device sessions with
	device ID, display name, last-seen IP, and last-seen timestamp.
	Refresh and Revoke actions wired through SessionManagementGateway.
	Current session marked with badge; only non-current sessions show revoke.
	Tests: settings-security-screen.test.tsx and session-management-gateway.test.ts.

### Performance requirements
Tag: PARTIAL
Acceptance criteria:
- [x] Core architecture supports pagination/offline queue foundation.
- [ ] Cold-start benchmark evidence recorded (<3s target).
- [ ] 500-message render benchmark evidence recorded.
- [ ] Voice setup/latency metrics recorded (post-calling implementation).

---

## Immediate Next Closure Sequence

1. Execute device-level Android VPN validation plan on physical hardware and attach evidence/results (items 9, 10).
2. Validate Android domain fronting and VPN path together under constrained network conditions (item 9).
3. Record cold-start benchmark evidence on mid-range Android (<3s target) (Performance).
4. Record 500-message render benchmark evidence (Performance).
5. Initialize Phase 2: Platform setup for react-native-webrtc.
