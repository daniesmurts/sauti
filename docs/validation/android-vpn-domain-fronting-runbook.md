# Android VPN + Domain Fronting Runbook

This runbook operationalizes NET-01, NET-02, and NET-03 from the Phase 1 closure plan.
Use it with:
- docs/validation/android-vpn-domain-fronting-validation.md
- scripts/validation/android-evidence-capture.sh

## Prerequisites
- Physical Android device connected with USB debugging enabled.
- Device authorized in adb (accept RSA prompt on phone if shown).
- Latest app build installed on device.
- Backend reachable and smoke receiver account ready.
- adb available in PATH.

If multiple devices are connected, set ANDROID_SERIAL to target one device explicitly.

## Evidence Session Setup
1. Start capture session:
```bash
cd SautiApp
RUN_ID=net01-$(date +%Y%m%d-%H%M%S) bash scripts/validation/android-evidence-capture.sh start
```
With explicit device selection:
```bash
RUN_ID=net01-$(date +%Y%m%d-%H%M%S) ANDROID_SERIAL=<device-serial> bash scripts/validation/android-evidence-capture.sh start
```
2. During each step, capture screenshots:
```bash
RUN_ID=<same-run-id> bash scripts/validation/android-evidence-capture.sh screenshot step-1-deny
```
3. Stop capture at end:
```bash
RUN_ID=<same-run-id> bash scripts/validation/android-evidence-capture.sh stop
```
4. Attach artifacts from artifacts/validation/<run-id>/ into the validation report.

## NET-01 Procedure
1. Fresh install -> tap Enable Proxy.
- Verify permission dialog appears.
- Deny once and verify warning banner + red status + messaging still works.

2. Re-enable and grant permission.
- Verify VPN key icon and green status.

3. Background app for 60 seconds.
- Reopen and verify VPN remains active.

4. Airplane mode on/off.
- On: status amber/red and queue retention.
- Off: queued message retry succeeds and proxy reconnects.

5. Kill app from recents and relaunch.
- Verify tunnel resumes as expected.

6. Disconnect VPN from Android Settings.
- Verify status indicator updates to disconnected.

7. Always-on VPN leak check.
- Enable Always-on VPN.
- Kill app and verify no leaks via capture/log tools.

## NET-02 Procedure (Constrained Network)
Run messaging scenarios under:
- High latency
- Packet loss
- Low bandwidth
- Intermittent connectivity

For each scenario record:
- Tool/setup used (network conditioner/proxy/emulator router).
- Whether messages eventually deliver.
- Whether proxy status transitions are accurate.

## NET-03 Smoke Message
1. Open app and send message literal:
- SMOKE_FINAL_PROXY_TEST
2. Target receiver:
- @smoke_receiver:matrix.sauti.ru
3. Capture sender proof, receiver proof, and timestamps.

## Completion Criteria
- Validation report fully filled with pass/fail per step.
- Artifacts attached for each step.
- Any failures filed as follow-up tickets with owner and severity.
