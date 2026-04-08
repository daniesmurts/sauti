/**
 * Tests for CallSignaling — outbound send methods and inbound event dispatch.
 */

import {
  CallSignaling,
  type CallSignalingTransport,
  type CallSignalingEvent,
} from '../src/modules/calling/webrtc/CallSignaling';

function makeTransport(): jest.Mocked<CallSignalingTransport> & {
  _emit: (roomId: string, senderId: string, type: string, content: unknown) => void;
} {
  let capturedHandler: ((roomId: string, senderId: string, type: string, content: unknown) => void) | null = null;

  const transport = {
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
  return transport;
}

describe('CallSignaling', () => {
  const ROOM_ID = '!room:sauti.test';
  const SENDER = '@peer:sauti.test';
  const CALL_ID = 'call-abc-123';

  let transport: ReturnType<typeof makeTransport>;
  let signaling: CallSignaling;

  beforeEach(() => {
    transport = makeTransport();
    signaling = new CallSignaling(transport);
  });

  afterEach(() => {
    signaling.destroy();
  });

  // ── Outbound ──────────────────────────────────────────────────────────────

  describe('sendInvite', () => {
    it('sends m.call.invite with offer SDP and lifetime', async () => {
      await signaling.sendInvite(ROOM_ID, CALL_ID, 'mock-offer-sdp', 45_000);

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(ROOM_ID, 'm.call.invite', {
        call_id: CALL_ID,
        lifetime: 45_000,
        offer: {type: 'offer', sdp: 'mock-offer-sdp'},
        version: '1',
      });
    });

    it('uses 60 000 ms default lifetime', async () => {
      await signaling.sendInvite(ROOM_ID, CALL_ID, 'sdp');

      const content = transport.sendRoomEvent.mock.calls[0][2] as {lifetime: number};
      expect(content.lifetime).toBe(60_000);
    });
  });

  describe('sendAnswer', () => {
    it('sends m.call.answer with answer SDP', async () => {
      await signaling.sendAnswer(ROOM_ID, CALL_ID, 'mock-answer-sdp');

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(ROOM_ID, 'm.call.answer', {
        call_id: CALL_ID,
        answer: {type: 'answer', sdp: 'mock-answer-sdp'},
        version: '1',
      });
    });
  });

  describe('sendCandidates', () => {
    it('sends m.call.candidates with batched ICE candidates', async () => {
      const candidates = [
        {candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0},
        {candidate: 'candidate:2', sdpMid: '1', sdpMLineIndex: 1},
      ];
      await signaling.sendCandidates(ROOM_ID, CALL_ID, candidates);

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(ROOM_ID, 'm.call.candidates', {
        call_id: CALL_ID,
        candidates,
        version: '1',
      });
    });
  });

  describe('sendHangup', () => {
    it('sends m.call.hangup with reason', async () => {
      await signaling.sendHangup(ROOM_ID, CALL_ID, 'user_hangup');

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(ROOM_ID, 'm.call.hangup', {
        call_id: CALL_ID,
        reason: 'user_hangup',
        version: '1',
      });
    });

    it('sends m.call.hangup without reason when omitted', async () => {
      await signaling.sendHangup(ROOM_ID, CALL_ID);

      const content = transport.sendRoomEvent.mock.calls[0][2] as {reason?: string};
      expect(content.reason).toBeUndefined();
    });
  });

  describe('sendReject', () => {
    it('sends m.call.reject', async () => {
      await signaling.sendReject(ROOM_ID, CALL_ID);

      expect(transport.sendRoomEvent).toHaveBeenCalledWith(ROOM_ID, 'm.call.reject', {
        call_id: CALL_ID,
        version: '1',
      });
    });
  });

  // ── Inbound dispatch ──────────────────────────────────────────────────────

  describe('inbound event dispatch', () => {
    let received: CallSignalingEvent[];
    let unsub: () => void;

    beforeEach(() => {
      received = [];
      unsub = signaling.subscribe(e => received.push(e));
    });

    afterEach(() => {
      unsub();
    });

    it('dispatches m.call.invite as kind=invite', () => {
      const content = {call_id: CALL_ID, lifetime: 60_000, offer: {type: 'offer', sdp: 'sdp'}, version: '1'};
      transport._emit(ROOM_ID, SENDER, 'm.call.invite', content);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({kind: 'invite', roomId: ROOM_ID, senderId: SENDER});
    });

    it('dispatches m.call.answer as kind=answer', () => {
      const content = {call_id: CALL_ID, answer: {type: 'answer', sdp: 'sdp'}, version: '1'};
      transport._emit(ROOM_ID, SENDER, 'm.call.answer', content);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({kind: 'answer', roomId: ROOM_ID, senderId: SENDER});
    });

    it('dispatches m.call.candidates as kind=candidates', () => {
      const content = {call_id: CALL_ID, candidates: [], version: '1'};
      transport._emit(ROOM_ID, SENDER, 'm.call.candidates', content);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({kind: 'candidates'});
    });

    it('dispatches m.call.hangup as kind=hangup', () => {
      const content = {call_id: CALL_ID, reason: 'user_hangup', version: '1'};
      transport._emit(ROOM_ID, SENDER, 'm.call.hangup', content);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({kind: 'hangup'});
    });

    it('dispatches m.call.reject as kind=reject', () => {
      const content = {call_id: CALL_ID, version: '1'};
      transport._emit(ROOM_ID, SENDER, 'm.call.reject', content);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({kind: 'reject'});
    });

    it('ignores unknown event types', () => {
      transport._emit(ROOM_ID, SENDER, 'm.room.message', {body: 'hello'});

      expect(received).toHaveLength(0);
    });

    it('delivers events to multiple subscribers', () => {
      const second: CallSignalingEvent[] = [];
      const unsub2 = signaling.subscribe(e => second.push(e));

      transport._emit(ROOM_ID, SENDER, 'm.call.hangup', {call_id: CALL_ID, version: '1'});

      expect(received).toHaveLength(1);
      expect(second).toHaveLength(1);

      unsub2();
    });

    it('stops delivering after unsubscribe', () => {
      unsub();
      transport._emit(ROOM_ID, SENDER, 'm.call.invite', {
        call_id: CALL_ID,
        lifetime: 60_000,
        offer: {type: 'offer', sdp: 'sdp'},
        version: '1',
      });

      expect(received).toHaveLength(0);
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('unsubscribes transport and clears handlers', () => {
      const received: CallSignalingEvent[] = [];
      signaling.subscribe(e => received.push(e));

      signaling.destroy();

      transport._emit(ROOM_ID, SENDER, 'm.call.hangup', {call_id: CALL_ID, version: '1'});
      expect(received).toHaveLength(0);
    });
  });
});
