/**
 * CallKeepService tests.
 *
 * Verifies the bidirectional bridge between CallManager state changes and the
 * native react-native-callkeep module.
 */

import RNCallKeep from 'react-native-callkeep';
import {CallKeepService, callIdToUuid} from '../src/modules/calling/webrtc/CallKeepService';
import {CallManager} from '../src/modules/calling/webrtc/CallManager';
import {CallSignaling, type CallSignalingTransport} from '../src/modules/calling/webrtc/CallSignaling';
import {RTCPeerConnection} from 'react-native-webrtc';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockCallKeep = RNCallKeep as typeof RNCallKeep & {
  _emit(event: string, payload?: Record<string, unknown>): void;
  _reset(): void;
};

function makeTransport(): jest.Mocked<CallSignalingTransport> & {
  _emit: (roomId: string, senderId: string, type: string, content: unknown) => void;
} {
  let capturedHandler: ((roomId: string, senderId: string, type: string, content: unknown) => void) | null = null;
  return {
    sendRoomEvent: jest.fn<Promise<void>, [string, string, object]>().mockResolvedValue(undefined),
    subscribeCallEvents: jest.fn().mockImplementation((h: typeof capturedHandler) => {
      capturedHandler = h;
      return () => { capturedHandler = null; };
    }),
    _emit(roomId, senderId, type, content) {
      capturedHandler?.(roomId, senderId, type, content);
    },
  };
}

function makeManager(transport: ReturnType<typeof makeTransport>): CallManager {
  const signaling = new CallSignaling(transport);
  return new CallManager({
    iceConfig: {iceServers: [], iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle'},
    signaling,
    localUserId: '@self:sauti.test',
    createPeerConnection: (cfg) => new RTCPeerConnection(cfg),
  });
}

const ROOM_ID = '!room:sauti.test';
const PEER_ID = '@peer:sauti.test';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('callIdToUuid', () => {
  it('returns a string in UUID format', () => {
    const uuid = callIdToUuid('sauti-abc123-xyz456');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is deterministic for the same input', () => {
    const a = callIdToUuid('sauti-test-id');
    const b = callIdToUuid('sauti-test-id');
    expect(a).toBe(b);
  });

  it('produces different UUIDs for different inputs', () => {
    expect(callIdToUuid('call-1')).not.toBe(callIdToUuid('call-2'));
  });
});

describe('CallKeepService', () => {
  let transport: ReturnType<typeof makeTransport>;
  let manager: CallManager;
  let service: CallKeepService;

  beforeEach(() => {
    mockCallKeep._reset();
    transport = makeTransport();
    manager = makeManager(transport);
    service = new CallKeepService(manager, {appName: 'Sauti'});
  });

  afterEach(() => {
    service.destroy();
    manager.destroy();
  });

  // ── Setup ─────────────────────────────────────────────────────────────────

  describe('setup', () => {
    it('calls RNCallKeep.setup with app name', () => {
      expect(RNCallKeep.setup).toHaveBeenCalledWith(
        expect.objectContaining({
          ios: expect.objectContaining({appName: 'Sauti'}),
          android: expect.objectContaining({
            foregroundService: expect.objectContaining({channelId: 'com.sautiapp.calls'}),
          }),
        }),
      );
    });

    it('registers four event listeners on construction', () => {
      expect(RNCallKeep.addEventListener).toHaveBeenCalledWith('answerCall', expect.any(Function));
      expect(RNCallKeep.addEventListener).toHaveBeenCalledWith('endCall', expect.any(Function));
      expect(RNCallKeep.addEventListener).toHaveBeenCalledWith('didPerformDTMFAction', expect.any(Function));
      expect(RNCallKeep.addEventListener).toHaveBeenCalledWith('didToggleHoldCallAction', expect.any(Function));
    });
  });

  // ── CallManager → CallKeep ────────────────────────────────────────────────

  describe('CallManager state → CallKeep', () => {
    it('calls displayIncomingCall when CallManager transitions to ringing_in', async () => {
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'peer-call-1',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      expect(RNCallKeep.displayIncomingCall).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f-]{36}$/), // UUID format
        PEER_ID,
        PEER_ID,
        'generic',
        false,
      );
    });

    it('calls startCall when CallManager transitions to ringing_out', async () => {
      await manager.placeCall(ROOM_ID, PEER_ID);

      expect(RNCallKeep.startCall).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f-]{36}$/),
        PEER_ID,
        PEER_ID,
        'generic',
        false,
      );
    });

    it('calls setCurrentCallActive when CallManager reaches connected', async () => {
      await manager.placeCall(ROOM_ID, PEER_ID);
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      const uuid = callIdToUuid(callId);

      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      const pc = (manager as unknown as {pc: RTCPeerConnection & {_simulateIceConnected(): void}}).pc;
      pc?._simulateIceConnected();

      expect(RNCallKeep.setCurrentCallActive).toHaveBeenCalledWith(uuid);
    });

    it('calls endCall when CallManager ends (hangup)', async () => {
      await manager.placeCall(ROOM_ID, PEER_ID);
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      const uuid = callIdToUuid(callId);

      manager.hangUp();

      expect(RNCallKeep.endCall).toHaveBeenCalledWith(uuid);
    });

    it('calls endCall when CallManager ends (remote hangup)', async () => {
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'peer-call-2',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();
      const uuid = callIdToUuid('peer-call-2');

      transport._emit(ROOM_ID, PEER_ID, 'm.call.hangup', {
        call_id: 'peer-call-2',
        reason: 'user_hangup',
        version: '1',
      });
      await Promise.resolve();

      expect(RNCallKeep.endCall).toHaveBeenCalledWith(uuid);
    });
  });

  // ── CallKeep → CallManager ────────────────────────────────────────────────

  describe('CallKeep events → CallManager', () => {
    it('calls manager.answerCall() when answerCall event fires for the current ringing_in call', async () => {
      const CALL_ID = 'incoming-call-3';
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: CALL_ID,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      const uuid = callIdToUuid(CALL_ID);
      mockCallKeep._emit('answerCall', {callUUID: uuid});

      // Allow answerCall async path to resolve
      await Promise.resolve();
      await Promise.resolve();

      expect(manager.getState().status).toBe('connecting');
    });

    it('ignores answerCall for a different UUID', async () => {
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'call-xyz',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      mockCallKeep._emit('answerCall', {callUUID: 'wrong-uuid-0000-0000-0000-000000000000'});
      await Promise.resolve();

      // Still ringing_in — not answered
      expect(manager.getState().status).toBe('ringing_in');
    });

    it('calls manager.rejectCall() when endCall fires during ringing_in', async () => {
      const CALL_ID = 'decline-call';
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: CALL_ID,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      const uuid = callIdToUuid(CALL_ID);
      mockCallKeep._emit('endCall', {callUUID: uuid});

      expect(manager.getState().status).toBe('ended');
      expect((manager.getState() as {reason: string}).reason).toBe('rejected');
    });

    it('calls manager.hangUp() when endCall fires during an active call', async () => {
      await manager.placeCall(ROOM_ID, PEER_ID);
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;

      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      mockCallKeep._emit('endCall', {callUUID: callIdToUuid(callId)});

      expect(manager.getState().status).toBe('ended');
      expect((manager.getState() as {reason: string}).reason).toBe('hangup');
    });

    it('ignores endCall when idle', () => {
      mockCallKeep._emit('endCall', {callUUID: 'some-uuid'});
      expect(manager.getState().status).toBe('idle');
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes all event listeners on destroy', () => {
      service.destroy();
      expect(RNCallKeep.removeEventListener).toHaveBeenCalledWith('answerCall', expect.any(Function));
      expect(RNCallKeep.removeEventListener).toHaveBeenCalledWith('endCall', expect.any(Function));
    });

    it('stops reacting to CallManager state changes after destroy', async () => {
      service.destroy();
      ;(RNCallKeep.displayIncomingCall as jest.Mock).mockClear();

      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'post-destroy',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      expect(RNCallKeep.displayIncomingCall).not.toHaveBeenCalled();
    });
  });
});
