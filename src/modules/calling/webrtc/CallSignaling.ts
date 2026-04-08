/**
 * Matrix m.call.* signaling (MSC2746).
 *
 * Sends and receives the five call event types over Matrix room events.
 * All events are end-to-end encrypted because they are sent through a
 * standard Matrix room with E2EE enabled.
 *
 * Event types handled:
 *   m.call.invite    — caller sends SDP offer + lifetime
 *   m.call.answer    — callee sends SDP answer
 *   m.call.candidates — both sides exchange ICE candidates
 *   m.call.hangup    — either side ends the call
 *   m.call.reject    — callee explicitly rejects before answering
 */

export interface CallInviteContent {
  call_id: string;
  lifetime: number;
  offer: {type: 'offer'; sdp: string};
  version: '1';
}

export interface CallAnswerContent {
  call_id: string;
  answer: {type: 'answer'; sdp: string};
  version: '1';
}

export interface CallCandidatesContent {
  call_id: string;
  candidates: {candidate: string; sdpMid: string | null; sdpMLineIndex: number | null}[];
  version: '1';
}

export interface CallHangupContent {
  call_id: string;
  reason?: 'ice_failed' | 'invite_timeout' | 'user_hangup';
  version: '1';
}

export interface CallRejectContent {
  call_id: string;
  version: '1';
}

export type CallSignalingEvent =
  | {kind: 'invite'; roomId: string; senderId: string; content: CallInviteContent}
  | {kind: 'answer'; roomId: string; senderId: string; content: CallAnswerContent}
  | {kind: 'candidates'; roomId: string; senderId: string; content: CallCandidatesContent}
  | {kind: 'hangup'; roomId: string; senderId: string; content: CallHangupContent}
  | {kind: 'reject'; roomId: string; senderId: string; content: CallRejectContent};

/** Minimal interface required from the Matrix transport layer. */
export interface CallSignalingTransport {
  sendRoomEvent(roomId: string, type: string, content: object): Promise<void>;
  subscribeCallEvents(
    handler: (roomId: string, senderId: string, type: string, content: unknown) => void,
  ): () => void;
}

type SignalingHandler = (event: CallSignalingEvent) => void;

export class CallSignaling {
  private handlers = new Set<SignalingHandler>();
  private unsubscribeTransport: (() => void) | null = null;

  constructor(private readonly transport: CallSignalingTransport) {
    this.unsubscribeTransport = transport.subscribeCallEvents(
      (roomId, senderId, type, content) => {
        this.dispatch(roomId, senderId, type, content);
      },
    );
  }

  /** Subscribe to incoming signaling events. Returns an unsubscribe function. */
  subscribe(handler: SignalingHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  destroy(): void {
    this.unsubscribeTransport?.();
    this.unsubscribeTransport = null;
    this.handlers.clear();
  }

  // ── Outbound ────────────────────────────────────────────────────────────

  async sendInvite(
    roomId: string,
    callId: string,
    sdp: string,
    lifetimeMs = 60_000,
  ): Promise<void> {
    const content: CallInviteContent = {
      call_id: callId,
      lifetime: lifetimeMs,
      offer: {type: 'offer', sdp},
      version: '1',
    };
    await this.transport.sendRoomEvent(roomId, 'm.call.invite', content);
  }

  async sendAnswer(roomId: string, callId: string, sdp: string): Promise<void> {
    const content: CallAnswerContent = {
      call_id: callId,
      answer: {type: 'answer', sdp},
      version: '1',
    };
    await this.transport.sendRoomEvent(roomId, 'm.call.answer', content);
  }

  async sendCandidates(
    roomId: string,
    callId: string,
    candidates: CallCandidatesContent['candidates'],
  ): Promise<void> {
    const content: CallCandidatesContent = {
      call_id: callId,
      candidates,
      version: '1',
    };
    await this.transport.sendRoomEvent(roomId, 'm.call.candidates', content);
  }

  async sendHangup(
    roomId: string,
    callId: string,
    reason?: CallHangupContent['reason'],
  ): Promise<void> {
    const content: CallHangupContent = {call_id: callId, reason, version: '1'};
    await this.transport.sendRoomEvent(roomId, 'm.call.hangup', content);
  }

  async sendReject(roomId: string, callId: string): Promise<void> {
    const content: CallRejectContent = {call_id: callId, version: '1'};
    await this.transport.sendRoomEvent(roomId, 'm.call.reject', content);
  }

  // ── Inbound dispatch ────────────────────────────────────────────────────

  private dispatch(
    roomId: string,
    senderId: string,
    type: string,
    content: unknown,
  ): void {
    let event: CallSignalingEvent | null = null;

    switch (type) {
      case 'm.call.invite':
        event = {kind: 'invite', roomId, senderId, content: content as CallInviteContent};
        break;
      case 'm.call.answer':
        event = {kind: 'answer', roomId, senderId, content: content as CallAnswerContent};
        break;
      case 'm.call.candidates':
        event = {
          kind: 'candidates',
          roomId,
          senderId,
          content: content as CallCandidatesContent,
        };
        break;
      case 'm.call.hangup':
        event = {kind: 'hangup', roomId, senderId, content: content as CallHangupContent};
        break;
      case 'm.call.reject':
        event = {kind: 'reject', roomId, senderId, content: content as CallRejectContent};
        break;
    }

    if (event) {
      this.handlers.forEach(h => h(event!));
    }
  }
}
