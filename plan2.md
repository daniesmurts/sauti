# Plan 2 - Phase 1 Closure Implementation Plan

## Objective
Close all remaining open Phase 1 items and cross-cutting Security/Performance gates so Messaging MVP is release-ready.

## Scope Lock (Do Not Drift)
- In scope: open items currently marked PARTIAL under Phase 1 and cross-cutting gates in MASTER_CHECKLIST.
- Out of scope: all Phase 2 and Phase 3 feature work.
- Out of scope: architecture changes to locked stack without ADR and team sign-off.

## Source of Truth
- Product and technical requirements: masterSpec.md
- Status and closure criteria: MASTER_CHECKLIST.md

## Definition of Done
An item moves to DONE only when all of the following are true:
- Acceptance criteria are fully checked.
- At least one validating test exists and passes.
- Evidence artifact is attached (logs, screenshots, benchmark output, or runbook records).
- Checklist status is updated in the same PR that includes tests/evidence.

## Traceability Matrix (Spec -> Execution)
- Security hard requirements
	- masterSpec.md Section 8.2, 8.3, 8.5
	- MASTER_CHECKLIST.md "Security hard requirements"
- ConversationList/NewConversation UX
	- masterSpec.md Section 7.3
	- MASTER_CHECKLIST.md "ConversationList + ChatRoom screens"
- Proxy and VPN validation
	- masterSpec.md Section 3.3, 8.2
	- MASTER_CHECKLIST.md items 9, 10, 11 and Immediate Next Closure Sequence
- Performance evidence
	- masterSpec.md Section 1.2 and Section 9
	- MASTER_CHECKLIST.md "Performance requirements"

## Execution Order
1. Security hard requirements
2. ConversationList and NewConversation UX gaps
3. Android proxy/VPN real-device validation and final smoke
4. Performance benchmark evidence
5. Checklist and closure hardening

## Sprint 1 (Week 1) - Security Hard Requirements

### SEC-01 Screenshot Prevention
Deliverables:
- Enable screenshot prevention for ChatRoom and CallScreen.

Acceptance:
- ChatRoom blocks screenshots/screen recording where platform supports it.
- CallScreen blocks screenshots/screen recording where platform supports it.

Tests:
- Add screen-level behavior tests and integration assertions for lifecycle enable/disable.

Evidence:
- Device screenshots showing prevention behavior and platform caveats.

### SEC-02 TLS Pinning for Fronted Transport
Deliverables:
- Add certificate/public key pinning path for fronted transport.
- Ensure failures do not downgrade to HTTP.

Acceptance:
- Fronted connection succeeds with valid pin.
- Fronted connection fails closed on pin mismatch.
- No plaintext fallback path exists.

Tests:
- Unit tests for pin validation path.
- Integration test for fail-closed behavior.

Evidence:
- Test output and network logs proving fail-closed behavior.

### SEC-03 Device and Session Management UX Baseline
Deliverables:
- Settings UX: list active sessions and revoke a selected session.

Acceptance:
- Active sessions are visible and refreshable.
- Revoke action triggers backend/session invalidation and updates UI state.

Tests:
- Service tests for session list/revoke.
- Screen tests for state, error, and loading flows.

Evidence:
- UI capture plus API/log proof of session revocation.

Sprint 1 exit criteria:
- All three Security hard requirement unchecked lines in MASTER_CHECKLIST are ready to flip to DONE.

## Sprint 2 (Week 2) - Messaging UX Completion

### MSG-01 Conversation Swipe Actions
Deliverables:
- Swipe-left action(s) for archive and mute in ConversationList.

Acceptance:
- Swipe actions are available on each supported row.
- Archive and mute state persists and reflects in UI.

Tests:
- Interaction tests for swipe gestures.
- Store/service tests for archive/mute state transitions.

Evidence:
- Video capture of swipe flows and test run output.

### MSG-02 NewConversation FAB and Contact Search
Deliverables:
- FAB entry point from ConversationList.
- NewConversation screen with contact search and start-conversation flow.

Acceptance:
- FAB opens NewConversation reliably.
- Search returns contact matches and supports selection.
- Starting a conversation routes to chat room correctly.

Tests:
- Navigation tests for FAB -> NewConversation -> ChatRoom.
- Search/filter tests for contact query behavior.

Evidence:
- Screen recording plus test output.

Sprint 2 exit criteria:
- ConversationList + ChatRoom checklist item is ready to flip to DONE.

## Sprint 3 (Week 3) - Censorship Resistance Validation

### NET-01 Device-level Android VPN Validation
Deliverables:
- Execute the full VPN validation matrix already documented in MASTER_CHECKLIST item 10.

Acceptance:
- All required checks marked pass/fail with notes.
- Any failures have issue tickets with severity and owner.

Evidence:
- Per-step logs, screenshots, and a signed validation report.

### NET-02 Domain Fronting plus VPN Constrained Network Validation
Deliverables:
- Validate fronting + VPN path under constrained conditions.

Acceptance:
- Messaging remains reliable through constrained network scenarios.
- Proxy status indicators are accurate throughout transitions.

Tests:
- Manual validation protocol with deterministic steps.

Evidence:
- Condition matrix, pass/fail, logs, and captures.

### NET-03 Final App Smoke Test
Deliverables:
- Send SMOKE_FINAL_PROXY_TEST message through app to smoke receiver account.

Acceptance:
- Message sent and received successfully through intended path.

Evidence:
- Timestamped sender/receiver proof and relevant service logs.

Sprint 3 exit criteria:
- Open validation items for checklist sections 9, 10, and 11 are ready to flip to DONE.

## Sprint 4 (Week 4) - Performance Evidence and Release Readiness

### PERF-01 Cold Start Benchmark
Deliverables:
- Run and document cold-start benchmark on target Android class.

Acceptance:
- Measured startup is under 3 seconds to interactive, or performance issue ticket created.

Evidence:
- Flipper startup captures and summarized benchmark table.

### PERF-02 500-Message Render Benchmark
Deliverables:
- Run and document 500-message render benchmark.

Acceptance:
- No frame drops over the threshold defined by masterSpec Section 9.
- If threshold is missed, backlog ticket includes profile trace and fix plan.

Evidence:
- Profiling traces and summary report.

Sprint 4 exit criteria:
- Performance requirements checklist lines are ready to flip to DONE.

## Cross-Sprint Guardrails (Mandatory)
- Do not import matrix-js-sdk outside src/core/matrix.
- Do not store credentials in AsyncStorage.
- Do not add plaintext HTTP fallback for any secure transport path.
- Do not use raw console.log in production code paths.
- Do not mark checklist items DONE without test plus evidence in the same PR.

## Ticket List (Execution Backlog)
- SEC-01 Screenshot prevention integration plus tests
- SEC-02 TLS pinning for fronted transport plus tests
- SEC-03 Device/session management UX baseline plus tests
- MSG-01 Conversation archive/mute swipe actions plus tests
- MSG-02 NewConversation FAB plus contact search plus tests
- NET-01 Android VPN validation execution and evidence
- NET-02 Domain fronting plus VPN constrained-network validation
- NET-03 End-to-end smoke message via app
- PERF-01 Cold-start benchmark runbook plus evidence
- PERF-02 500-message render benchmark runbook plus evidence
- OPS-01 Checklist evidence template and closure workflow

## Dependencies and Blockers
- Physical Android device availability for Sprint 3.
- Network conditioning setup for constrained-path validation.
- Smoke receiver account and backend environment must remain active during Sprint 3.

## Success Metrics
- All currently PARTIAL Phase 1/security/performance target items moved to DONE.
- All currently open Immediate Next Closure Sequence items completed with evidence.
- No regression in full test suite pass rate.
- Repeatable benchmark process established for future releases.

## Weekly Cadence
- Day 1: Implementation start, test scaffolding, risk check.
- Day 2-3: Main feature delivery and unit/component tests.
- Day 4: Integration/regression testing and evidence capture.
- Day 5: Checklist status updates, documentation, and release-readiness review.