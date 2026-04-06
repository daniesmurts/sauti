# Android VPN + Domain Fronting Validation Report

Purpose:
- Capture evidence for NET-01 and NET-02 closure in the Phase 1 plan.
- Record reproducible device-level validation outcomes.

Environment
- Date:
- Tester:
- Device model:
- Android version:
- App build/version:
- Network profile (carrier/WiFi):
- Backend target:

## NET-01 Device-level VPN Validation

### 1. Fresh install -> Enable Proxy
Expected:
- System VPN permission dialog appears.
- Deny path: warning banner visible, status red, app messaging still works.

Observed:
- Permission dialog shown: [PASS/FAIL]
- Deny path behavior: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 2. Grant permission
Expected:
- VPN key icon appears.
- Status dot becomes green.

Observed:
- VPN key icon: [PASS/FAIL]
- Status indicator: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 3. Background 60s then reopen
Expected:
- VPN remains active.

Observed:
- Active after resume: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 4. Airplane mode on/off
Expected:
- On: status amber/red and queue retains pending message.
- Off: retries deliver and VPN reconnects.

Observed:
- Airplane on behavior: [PASS/FAIL]
- Airplane off recovery: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 5. Kill app from recents -> relaunch
Expected:
- VPN restarts (START_STICKY behavior).

Observed:
- Restarted after relaunch: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 6. Disconnect VPN from Android Settings
Expected:
- VPN key icon disappears.
- Status shows disconnected/grey.

Observed:
- Key icon removed: [PASS/FAIL]
- App status update: [PASS/FAIL]
Evidence:
- Screenshot(s):
- Notes:

### 7. Always-on VPN leak check
Expected:
- No traffic leaks when app is killed and always-on is enabled.

Observed:
- Leak check result: [PASS/FAIL]
Method:
- Packet capture / network log tool used:
Evidence:
- Capture/log artifact:
- Notes:

## NET-02 Constrained Network Validation

Scenarios
- High latency
- Packet loss
- Low bandwidth
- Intermittent connectivity

For each scenario, record:
- Scenario:
- Tool/setup:
- Messaging outcome: [PASS/FAIL]
- Proxy status transitions accurate: [PASS/FAIL]
- Evidence links:
- Notes:

## NET-03 Smoke Message Validation

Expected:
- Send message `SMOKE_FINAL_PROXY_TEST` from app to `@smoke_receiver:matrix.sauti.ru`.

Observed:
- Send success: [PASS/FAIL]
- Receive success: [PASS/FAIL]
Evidence:
- Sender screenshot/log:
- Receiver screenshot/log:
- Timestamp:

## Summary
- NET-01 status:
- NET-02 status:
- NET-03 status:
- Blocking issues:
- Follow-up ticket IDs:
