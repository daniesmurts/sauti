/**
 * CallManager state-machine tests.
 *
 * Uses the injectable createPeerConnection factory and a mock CallSignaling
 * transport so no native WebRTC code runs.
 */

import {CallManager, type CallState} from '../src/modules/calling/webrtc/CallManager';
import {CallSignaling, type CallSignalingTransport} from '../src/modules/calling/webrtc/CallSignaling';
import {RTCPeerConnection} from 'react-native-webrtc';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTransport(): jest.Mocked<CallSignalingTransport> & {
  _emit: (roomId: string, senderId: string, type: string, content: unknown) => void;
} {
  let capturedHandler: ((roomId: string, senderId: string, type: string, content: unknown) => void) | null = null;

  return {
    sendRoomEvent: jest.fn<Promise<void>, [string, string, object]>().mockResolvedValue(undefined),
    subscribeCallEvents: jest.fn().mockImplementation(
      (handler: (roomId: string, senderId: string, type: string, content: unknown) => void) => {
        capturedHandler = handler;
        return () => {
          capturedHandler = null;
        };
      },
    ),
    _emit(roomId: string, senderId: string, type: string, content: unknown) {
      capturedHandler?.(roomId, senderId, type, content);
    },
  };
}

function makeCallManager(
  opts: {ringTimeoutMs?: number; localUserId?: string} = {},
): {
  manager: CallManager;
  transport: ReturnType<typeof makeTransport>;
  signaling: CallSignaling;
  latestPc: () => RTCPeerConnection;
  states: CallState[];
} {
  const transport = makeTransport();
  const signaling = new CallSignaling(transport);

  let lastPc: RTCPeerConnection | null = null;

  const states: CallState[] = [];
  const manager = new CallManager({
    iceConfig: {iceServers: [], iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle'},
    signaling,
    localUserId: opts.localUserId ?? '@self:sauti.test',
    ringTimeoutMs: opts.ringTimeoutMs ?? 60_000,
    createPeerConnection: (cfg) => {
      const pc = new RTCPeerConnection(cfg);
      lastPc = pc;
      return pc;
    },
  });
  manager.subscribe(s => states.push(s));

  return {
    manager,
    transport,
    signaling,
    latestPc: () => {
      if (!lastPc) throw new Error('No RTCPeerConnection has been created yet');
      return lastPc;
    },
    states,
  };
}

const ROOM_ID = '!room:sauti.test';
const PEER_ID = '@peer:sauti.test';
const LOCAL_ID = '@self:sauti.test';
const CALL_ID_PATTERN = /^sauti-/;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CallManager', () => {
  describe('idle state', () => {
    it('starts in idle', () => {
      const {manager} = makeCallManager();
      expect(manager.getState().status).toBe('idle');
      manager.destroy();
    });

    it('placeCall transitions to ringing_out', async () => {
      const {manager, states} = makeCallManager();

      await manager.placeCall(ROOM_ID, PEER_ID);

      expect(states[0]?.status).toBe('ringing_out');
      expect(manager.getState().status).toBe('ringing_out');
      manager.destroy();
    });

    it('placeCall stores roomId and peerId on the call', async () => {
      const {manager} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const state = manager.getState();
      expect(state.status).toBe('ringing_out');
      if (state.status === 'ringing_out') {
        expect(state.call.roomId).toBe(ROOM_ID);
        expect(state.call.peerId).toBe(PEER_ID);
        expect(state.call.direction).toBe('outgoing');
        expect(state.call.callId).toMatch(CALL_ID_PATTERN);
      }
      manager.destroy();
    });

    it('placeCall sends m.call.invite via signaling', async () => {
      const {manager, transport} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(
        ROOM_ID,
        'm.call.invite',
        expect.objectContaining({
          offer: expect.objectContaining({type: 'offer'}),
          version: '1',
        }),
      );
      manager.destroy();
    });

    it('cannot place a call when already in a call', async () => {
      const {manager} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      await expect(manager.placeCall(ROOM_ID, PEER_ID)).rejects.toThrow('ringing_out');
      manager.destroy();
    });
  });

  describe('incoming invite → ringing_in', () => {
    it('transitions to ringing_in when m.call.invite arrives from peer', async () => {
      const {manager, transport} = makeCallManager();
      const INVITE_CALL_ID = 'peer-call-xyz';

      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: INVITE_CALL_ID,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'remote-offer-sdp'},
        version: '1',
      });

      // Allow microtasks to flush
      await Promise.resolve();

      const state = manager.getState();
      expect(state.status).toBe('ringing_in');
      if (state.status === 'ringing_in') {
        expect(state.call.callId).toBe(INVITE_CALL_ID);
        expect(state.call.peerId).toBe(PEER_ID);
        expect(state.call.direction).toBe('incoming');
        expect(state.offerSdp).toBe('remote-offer-sdp');
      }
      manager.destroy();
    });

    it('ignores invite from self', async () => {
      const {manager, transport} = makeCallManager();

      transport._emit(ROOM_ID, LOCAL_ID, 'm.call.invite', {
        call_id: 'self-call',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });

      await Promise.resolve();
      expect(manager.getState().status).toBe('idle');
      manager.destroy();
    });

    it('ignores a second invite while ringing_in', async () => {
      const {manager, transport} = makeCallManager();
      const FIRST_ID = 'first-call';

      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: FIRST_ID,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp1'},
        version: '1',
      });
      await Promise.resolve();

      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'second-call',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp2'},
        version: '1',
      });
      await Promise.resolve();

      const state = manager.getState();
      expect(state.status).toBe('ringing_in');
      if (state.status === 'ringing_in') {
        expect(state.call.callId).toBe(FIRST_ID);
      }
      manager.destroy();
    });
  });

  describe('outgoing call — remote answer', () => {
    it('transitions ringing_out → connecting on m.call.answer', async () => {
      const {manager, transport, states} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'remote-answer-sdp'},
        version: '1',
      });
      await Promise.resolve();

      expect(manager.getState().status).toBe('connecting');
      const connectingState = states.find(s => s.status === 'connecting');
      expect(connectingState).toBeDefined();
      manager.destroy();
    });

    it('ignores answer for a different call_id', async () => {
      const {manager, transport} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: 'wrong-call-id',
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      expect(manager.getState().status).toBe('ringing_out');
      manager.destroy();
    });

    it('transitions connecting → connected on ICE connected', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'remote-answer-sdp'},
        version: '1',
      });
      await Promise.resolve();

      (latestPc() as RTCPeerConnection & {_simulateIceConnected: () => void})._simulateIceConnected();

      expect(manager.getState().status).toBe('connected');
      manager.destroy();
    });
  });

  describe('outgoing call — remote reject', () => {
    it('transitions to ended(rejected) on m.call.reject', async () => {
      const {manager, transport} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.reject', {
        call_id: callId,
        version: '1',
      });
      await Promise.resolve();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') {
        expect(state.reason).toBe('rejected');
      }
      manager.destroy();
    });
  });

  describe('incoming call — answer', () => {
    async function setupRingingIn(transport: ReturnType<typeof makeTransport>, callId = 'peer-call') {
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: callId,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'remote-offer-sdp'},
        version: '1',
      });
      await Promise.resolve();
    }

    it('answerCall transitions ringing_in → connecting', async () => {
      const {manager, transport} = makeCallManager();
      await setupRingingIn(transport);

      await manager.answerCall();

      expect(manager.getState().status).toBe('connecting');
      manager.destroy();
    });

    it('answerCall sends m.call.answer', async () => {
      const {manager, transport} = makeCallManager();
      await setupRingingIn(transport);
      transport.sendRoomEvent.mockClear();

      await manager.answerCall();

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(
        ROOM_ID,
        'm.call.answer',
        expect.objectContaining({
          answer: expect.objectContaining({type: 'answer'}),
        }),
      );
      manager.destroy();
    });

    it('answerCall → ICE connected transitions to connected', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      await setupRingingIn(transport);
      await manager.answerCall();

      (latestPc() as RTCPeerConnection & {_simulateIceConnected: () => void})._simulateIceConnected();

      expect(manager.getState().status).toBe('connected');
      manager.destroy();
    });

    it('throws if answerCall called outside ringing_in', async () => {
      const {manager} = makeCallManager();
      await expect(manager.answerCall()).rejects.toThrow(/Cannot answer call/);
      manager.destroy();
    });
  });

  describe('incoming call — reject', () => {
    it('rejectCall transitions to ended(rejected)', async () => {
      const {manager, transport} = makeCallManager();
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'peer-call',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      manager.rejectCall();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') {
        expect(state.reason).toBe('rejected');
      }
      manager.destroy();
    });

    it('rejectCall sends m.call.reject', async () => {
      const {manager, transport} = makeCallManager();
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'peer-call',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();
      transport.sendRoomEvent.mockClear();

      manager.rejectCall();

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(
        ROOM_ID,
        'm.call.reject',
        expect.objectContaining({call_id: 'peer-call'}),
      );
      manager.destroy();
    });

    it('rejectCall is a no-op outside ringing_in', () => {
      const {manager} = makeCallManager();
      expect(() => manager.rejectCall()).not.toThrow();
      manager.destroy();
    });
  });

  describe('hangUp', () => {
    it('hangUp from ringing_out transitions to ended(hangup)', async () => {
      const {manager} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      manager.hangUp();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') expect(state.reason).toBe('hangup');
      manager.destroy();
    });

    it('hangUp from ringing_in transitions to ended(hangup)', async () => {
      const {manager, transport} = makeCallManager();
      transport._emit(ROOM_ID, PEER_ID, 'm.call.invite', {
        call_id: 'peer-call',
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      manager.hangUp();

      expect(manager.getState().status).toBe('ended');
      manager.destroy();
    });

    it('hangUp from connected transitions to ended(hangup)', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();
      (latestPc() as RTCPeerConnection & {_simulateIceConnected: () => void})._simulateIceConnected();

      manager.hangUp();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') expect(state.reason).toBe('hangup');
      manager.destroy();
    });

    it('hangUp sends m.call.hangup', async () => {
      const {manager, transport} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);
      transport.sendRoomEvent.mockClear();

      manager.hangUp();

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(
        ROOM_ID,
        'm.call.hangup',
        expect.objectContaining({reason: 'user_hangup'}),
      );
      manager.destroy();
    });

    it('hangUp is a no-op in idle state', () => {
      const {manager} = makeCallManager();
      expect(() => manager.hangUp()).not.toThrow();
      expect(manager.getState().status).toBe('idle');
      manager.destroy();
    });

    it('hangUp is a no-op in ended state', async () => {
      const {manager} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);
      manager.hangUp(); // → ended

      const states: CallState[] = [];
      manager.subscribe(s => states.push(s));
      manager.hangUp(); // should be no-op

      expect(states).toHaveLength(0);
      manager.destroy();
    });
  });

  describe('remote hangup', () => {
    it('transitions to ended(hangup) when peer sends m.call.hangup', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();
      (latestPc() as RTCPeerConnection & {_simulateIceConnected: () => void})._simulateIceConnected();

      transport._emit(ROOM_ID, PEER_ID, 'm.call.hangup', {
        call_id: callId,
        reason: 'user_hangup',
        version: '1',
      });
      await Promise.resolve();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') expect(state.reason).toBe('hangup');
      manager.destroy();
    });
  });

  describe('ICE failure', () => {
    it('transitions connecting → ended(failed) on ICE failed', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      (latestPc() as RTCPeerConnection & {_simulateIceFailed: () => void})._simulateIceFailed();

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') expect(state.reason).toBe('failed');
      manager.destroy();
    });
  });

  describe('ring timeout', () => {
    it('transitions to ended(timeout) if no answer arrives', async () => {
      jest.useFakeTimers();

      const {manager} = makeCallManager({ringTimeoutMs: 5_000});
      await manager.placeCall(ROOM_ID, PEER_ID);

      jest.advanceTimersByTime(5_001);

      const state = manager.getState();
      expect(state.status).toBe('ended');
      if (state.status === 'ended') expect(state.reason).toBe('timeout');

      manager.destroy();
      jest.useRealTimers();
    });

    it('does not fire timeout after hangUp', async () => {
      jest.useFakeTimers();

      const {manager} = makeCallManager({ringTimeoutMs: 5_000});
      await manager.placeCall(ROOM_ID, PEER_ID);
      manager.hangUp(); // → ended

      const states: CallState[] = [];
      manager.subscribe(s => states.push(s));

      jest.advanceTimersByTime(5_001); // timer should have been cleared

      // No additional state transitions
      expect(states).toHaveLength(0);

      manager.destroy();
      jest.useRealTimers();
    });
  });

  describe('ICE candidate batching', () => {
    it('sends batched candidates after 200ms debounce', async () => {
      jest.useFakeTimers();

      const {manager, transport, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      const pc = latestPc() as RTCPeerConnection & {_emitCandidate: (c: object) => void};
      transport.sendRoomEvent.mockClear();

      pc._emitCandidate({candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0});
      pc._emitCandidate({candidate: 'c2', sdpMid: '0', sdpMLineIndex: 0});

      // Not yet sent — debounce pending
      const candidateCalls = transport.sendRoomEvent.mock.calls.filter(
        c => c[1] === 'm.call.candidates',
      );
      expect(candidateCalls).toHaveLength(0);

      jest.advanceTimersByTime(200);

      const candidateCallsAfter = transport.sendRoomEvent.mock.calls.filter(
        c => c[1] === 'm.call.candidates',
      );
      expect(candidateCallsAfter).toHaveLength(1);
      expect((candidateCallsAfter[0][2] as {candidates: unknown[]}).candidates).toHaveLength(2);

      manager.destroy();
      jest.useRealTimers();
    });
  });

  describe('stream listeners', () => {
    it('fires onLocalStream when media is acquired', async () => {
      const {manager} = makeCallManager();
      const streams: unknown[] = [];
      manager.onLocalStream(s => streams.push(s));

      await manager.placeCall(ROOM_ID, PEER_ID);

      expect(streams).toHaveLength(1);
      manager.destroy();
    });

    it('fires onRemoteStream when a track event is received', async () => {
      const {manager, transport, latestPc} = makeCallManager();
      const remoteStreams: unknown[] = [];
      manager.onRemoteStream(s => remoteStreams.push(s));

      await manager.placeCall(ROOM_ID, PEER_ID);
      const callId = (manager.getState() as {call: {callId: string}}).call.callId;
      transport._emit(ROOM_ID, PEER_ID, 'm.call.answer', {
        call_id: callId,
        answer: {type: 'answer', sdp: 'sdp'},
        version: '1',
      });
      await Promise.resolve();

      // Import MediaStream from mock
      const {MediaStream} = require('react-native-webrtc');
      const fakeStream = new MediaStream();
      (latestPc() as RTCPeerConnection & {_emitTrack: (s: object) => void})._emitTrack(fakeStream);

      expect(remoteStreams).toHaveLength(1);
      expect(remoteStreams[0]).toBe(fakeStream);
      manager.destroy();
    });
  });

  describe('state subscription', () => {
    it('notifies all subscribers on each transition', async () => {
      const {manager} = makeCallManager();
      const s1: CallState[] = [];
      const s2: CallState[] = [];
      manager.subscribe(s => s1.push(s));
      manager.subscribe(s => s2.push(s));

      await manager.placeCall(ROOM_ID, PEER_ID);
      manager.hangUp();

      expect(s1.length).toBeGreaterThanOrEqual(2);
      expect(s2.length).toBe(s1.length);
      manager.destroy();
    });

    it('unsubscribe stops notifications', async () => {
      const {manager} = makeCallManager();
      const states: CallState[] = [];
      const unsub = manager.subscribe(s => states.push(s));

      await manager.placeCall(ROOM_ID, PEER_ID);
      unsub();
      manager.hangUp();

      // Only ringing_out — no ended event
      expect(states.every(s => s.status !== 'ended')).toBe(true);
      manager.destroy();
    });
  });

  describe('destroy', () => {
    it('cleans up without throwing', async () => {
      const {manager} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);
      expect(() => manager.destroy()).not.toThrow();
    });

    it('closes the RTCPeerConnection on destroy', async () => {
      const {manager, latestPc} = makeCallManager();
      await manager.placeCall(ROOM_ID, PEER_ID);

      manager.destroy();

      expect(latestPc().close).toHaveBeenCalled();
    });
  });
});
