/**
 * CallKeepService — bidirectional bridge between CallManager and
 * react-native-callkeep (Android ConnectionService / iOS CallKit).
 *
 * Responsibility split:
 *   CallManager → CallKeep   Mirrors state changes into the native call UI.
 *   CallKeep → CallManager   Translates native UI actions into CallManager calls.
 *
 * UUID strategy: CallKeep requires UUID v4 strings.  We derive a stable,
 * deterministic UUID from our opaque callId so both sides always agree on
 * the identifier without an explicit mapping table.
 */

import RNCallKeep from 'react-native-callkeep';
import {Platform} from 'react-native';
import type {CallManager, CallState, ActiveCall} from './CallManager';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CallKeepServiceOptions {
  appName: string;
  imageName?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts our opaque callId into a deterministic RFC-4122 v4-shaped UUID.
 * CallKeep only needs a stable unique string in UUID format — real randomness
 * is not required here.
 */
export function callIdToUuid(callId: string): string {
  // Strip non-hex, lowercase, pad/truncate to 32 hex chars
  const hex = callId
    .replace(/[^a-f0-9]/gi, '')
    .toLowerCase()
    .slice(0, 32)
    .padEnd(32, '0');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Force version nibble to '4'
    '4' + hex.slice(13, 16),
    // Force variant nibble to '8'
    '8' + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ── CallKeepService ──────────────────────────────────────────────────────────

export class CallKeepService {
  private unsubManager: (() => void) | null = null;

  constructor(
    private readonly manager: CallManager,
    options: CallKeepServiceOptions,
  ) {
    this.setup(options);
    this.unsubManager = manager.subscribe(s => this.onManagerStateChange(s));

    RNCallKeep.addEventListener('answerCall', this.onKeepAnswer);
    RNCallKeep.addEventListener('endCall', this.onKeepEnd);
    RNCallKeep.addEventListener('didPerformDTMFAction', this.onKeepDtmf);
    RNCallKeep.addEventListener('didToggleHoldCallAction', this.onKeepHold);
  }

  destroy(): void {
    this.unsubManager?.();
    this.unsubManager = null;

    RNCallKeep.removeEventListener('answerCall', this.onKeepAnswer);
    RNCallKeep.removeEventListener('endCall', this.onKeepEnd);
    RNCallKeep.removeEventListener('didPerformDTMFAction', this.onKeepDtmf);
    RNCallKeep.removeEventListener('didToggleHoldCallAction', this.onKeepHold);
  }

  // ── Private: setup ───────────────────────────────────────────────────────

  private setup(options: CallKeepServiceOptions): void {
    RNCallKeep.setup({
      ios: {appName: options.appName},
      android: {
        alertTitle: 'Phone account permissions required',
        alertDescription:
          'Sauti needs access to your phone accounts to make and receive encrypted calls.',
        cancelButton: 'Cancel',
        okButton: 'Allow',
        imageName: options.imageName ?? 'phone_account_icon',
        additionalPermissions: [],
        foregroundService: {
          channelId: 'com.sautiapp.calls',
          channelName: 'Sauti Calls',
          notificationTitle: 'Sauti call in progress',
        },
      },
    });

    if (Platform.OS === 'android') {
      RNCallKeep.setAvailable(true);
    }
  }

  // ── Private: CallManager → CallKeep ─────────────────────────────────────

  private onManagerStateChange(state: CallState): void {
    switch (state.status) {
      case 'ringing_in':
        this.displayIncoming(state.call);
        break;

      case 'ringing_out':
        this.reportOutgoing(state.call);
        break;

      case 'connecting':
        // Nothing extra — native UI already knows we answered
        break;

      case 'connected':
        RNCallKeep.setCurrentCallActive(callIdToUuid(state.call.callId));
        break;

      case 'ended':
        // Dismiss native UI regardless of who ended
        RNCallKeep.endCall(callIdToUuid(state.call.callId));
        break;

      default:
        break;
    }
  }

  private displayIncoming(call: ActiveCall): void {
    RNCallKeep.displayIncomingCall(
      callIdToUuid(call.callId),
      call.peerId,
      call.peerId,
      'generic',
      false, // voice only
    );
  }

  private reportOutgoing(call: ActiveCall): void {
    RNCallKeep.startCall(
      callIdToUuid(call.callId),
      call.peerId,
      call.peerId,
      'generic',
      false,
    );
  }

  // ── Private: CallKeep → CallManager ─────────────────────────────────────

  private readonly onKeepAnswer = ({callUUID}: {callUUID: string}): void => {
    const state = this.manager.getState();
    if (
      state.status === 'ringing_in' &&
      callIdToUuid(state.call.callId) === callUUID
    ) {
      void this.manager.answerCall();
    }
  };

  private readonly onKeepEnd = ({callUUID}: {callUUID: string}): void => {
    const state = this.manager.getState();
    if (state.status === 'idle' || state.status === 'ended') return;
    if (callIdToUuid(state.call.callId) !== callUUID) return;

    if (state.status === 'ringing_in') {
      this.manager.rejectCall();
    } else {
      this.manager.hangUp();
    }
  };

  // Ignored for now — voice calls only
  private readonly onKeepDtmf = (_event: unknown): void => {};
  private readonly onKeepHold = (_event: unknown): void => {};
}
