/**
 * CallManager — WebRTC call lifecycle state machine.
 *
 * State transitions:
 *
 *   idle
 *     ├─ placeCall()       → ringing_out
 *     └─ receiveInvite()   → ringing_in
 *
 *   ringing_out
 *     ├─ _onRemoteAnswer() → connecting
 *     ├─ _onRemoteReject() → ended (rejected)
 *     ├─ hangUp()          → ended (hangup)
 *     └─ timeout           → ended (timeout)
 *
 *   ringing_in
 *     ├─ answerCall()      → connecting
 *     ├─ rejectCall()      → ended (rejected)
 *     └─ _onRemoteHangup() → ended (hangup)
 *
 *   connecting
 *     ├─ _onIceConnected() → connected
 *     ├─ _onIceFailed()    → ended (failed)
 *     └─ hangUp()          → ended (hangup)
 *
 *   connected
 *     ├─ hangUp()          → ended (hangup)
 *     └─ _onRemoteHangup() → ended (hangup)
 *
 *   ended  (terminal — no further transitions)
 *
 * The RTCPeerConnection factory is injectable for unit testing.
 */

import {RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream} from 'react-native-webrtc';
import type {RTCIceCandidateInit, RTCSessionDescriptionInit} from 'react-native-webrtc';
import {CallSignaling} from './CallSignaling';
import {RTCConfiguration, QUALITY_PRESETS, QualityPreset} from './IceConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export type EndReason = 'hangup' | 'rejected' | 'failed' | 'timeout' | 'no_answer';

export interface ActiveCall {
  callId: string;
  roomId: string;
  peerId: string;
  direction: 'incoming' | 'outgoing';
  startedAt?: number;
}

export type CallState =
  | {status: 'idle'}
  | {status: 'ringing_out'; call: ActiveCall}
  | {status: 'ringing_in'; call: ActiveCall; offerSdp: string}
  | {status: 'connecting'; call: ActiveCall}
  | {status: 'connected'; call: ActiveCall}
  | {status: 'ended'; call: ActiveCall; reason: EndReason};

type PeerConnectionFactory = (config: RTCConfiguration) => RTCPeerConnection;

export interface CallManagerOptions {
  iceConfig: RTCConfiguration;
  signaling: CallSignaling;
  localUserId: string;
  /** Override for unit tests — defaults to real RTCPeerConnection. */
  createPeerConnection?: PeerConnectionFactory;
  /** Milliseconds before an unanswered outgoing call times out. Default 60 000. */
  ringTimeoutMs?: number;
}

// ── CallManager ──────────────────────────────────────────────────────────────

export class CallManager {
  private state: CallState = {status: 'idle'};
  private listeners = new Set<(s: CallState) => void>();
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localStreamListeners = new Set<(s: MediaStream) => void>();
  private remoteStreamListeners = new Set<(s: MediaStream) => void>();
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubSignaling: (() => void) | null = null;

  private readonly iceConfig: RTCConfiguration;
  private readonly signaling: CallSignaling;
  private readonly localUserId: string;
  private readonly createPc: PeerConnectionFactory;
  private readonly ringTimeoutMs: number;

  constructor(opts: CallManagerOptions) {
    this.iceConfig = opts.iceConfig;
    this.signaling = opts.signaling;
    this.localUserId = opts.localUserId;
    this.createPc = opts.createPeerConnection ?? ((cfg) => new RTCPeerConnection(cfg));
    this.ringTimeoutMs = opts.ringTimeoutMs ?? 60_000;

    this.unsubSignaling = this.signaling.subscribe(event => {
      void this.handleSignalingEvent(event);
    });
  }

  // ── State subscription ───────────────────────────────────────────────────

  getState(): CallState {
    return this.state;
  }

  subscribe(listener: (s: CallState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onLocalStream(listener: (s: MediaStream) => void): () => void {
    this.localStreamListeners.add(listener);
    if (this.localStream) listener(this.localStream);
    return () => this.localStreamListeners.delete(listener);
  }

  onRemoteStream(listener: (s: MediaStream) => void): () => void {
    this.remoteStreamListeners.add(listener);
    if (this.remoteStream) listener(this.remoteStream);
    return () => this.remoteStreamListeners.delete(listener);
  }

  // ── Public actions ───────────────────────────────────────────────────────

  async placeCall(roomId: string, peerId: string, preset: QualityPreset = 'voice_only'): Promise<void> {
    if (this.state.status !== 'idle') {
      throw new Error(`Cannot place call in state: ${this.state.status}`);
    }

    const callId = generateCallId();
    const call: ActiveCall = {callId, roomId, peerId, direction: 'outgoing'};
    this.transition({status: 'ringing_out', call});

    this.startRingTimer(callId, roomId);

    try {
      const stream = await this.acquireLocalMedia(preset);
      const pc = this.buildPeerConnection(call, stream);

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(new RTCSessionDescription(offer));

      await this.signaling.sendInvite(
        roomId,
        callId,
        offer.sdp ?? '',
        this.ringTimeoutMs,
      );
    } catch (err) {
      this.endCall(call, 'failed');
      throw err;
    }
  }

  /** Accept an incoming call that has arrived via receiveInvite() internally. */
  async answerCall(preset: QualityPreset = 'voice_only'): Promise<void> {
    if (this.state.status !== 'ringing_in') {
      throw new Error(`Cannot answer call in state: ${this.state.status}`);
    }

    const {call, offerSdp} = this.state;
    this.transition({status: 'connecting', call});

    try {
      const stream = await this.acquireLocalMedia(preset);
      const pc = this.buildPeerConnection(call, stream);

      await pc.setRemoteDescription(
        new RTCSessionDescription({type: 'offer', sdp: offerSdp}),
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(new RTCSessionDescription(answer));

      await this.signaling.sendAnswer(call.roomId, call.callId, answer.sdp ?? '');
    } catch (err) {
      this.endCall(call, 'failed');
      throw err;
    }
  }

  rejectCall(): void {
    if (this.state.status !== 'ringing_in') return;
    const {call} = this.state;
    void this.signaling.sendReject(call.roomId, call.callId);
    this.endCall(call, 'rejected');
  }

  hangUp(): void {
    const s = this.state;
    if (s.status === 'idle' || s.status === 'ended') return;
    void this.signaling.sendHangup(s.call.roomId, s.call.callId, 'user_hangup');
    this.endCall(s.call, 'hangup');
  }

  destroy(): void {
    this.unsubSignaling?.();
    this.unsubSignaling = null;
    this.tearDownPc();
    this.clearRingTimer();
    this.listeners.clear();
  }

  // ── Signaling event handler ──────────────────────────────────────────────

  private async handleSignalingEvent(
    event: Awaited<ReturnType<CallSignaling['subscribe']>> extends (...args: infer A) => unknown
      ? A[0]
      : never,
  ): Promise<void> {
    // Re-type since TS can't infer CallSignalingEvent from subscribe cb
    const e = event as import('./CallSignaling').CallSignalingEvent;

    // Ignore events sent by ourselves
    if (e.senderId === this.localUserId) return;

    switch (e.kind) {
      case 'invite': {
        if (this.state.status !== 'idle') break; // Already in a call
        const call: ActiveCall = {
          callId: e.content.call_id,
          roomId: e.roomId,
          peerId: e.senderId,
          direction: 'incoming',
        };
        this.transition({status: 'ringing_in', call, offerSdp: e.content.offer.sdp});
        break;
      }

      case 'answer': {
        if (this.state.status !== 'ringing_out') break;
        if (e.content.call_id !== this.state.call.callId) break;
        this.clearRingTimer();
        const {call} = this.state;
        this.transition({status: 'connecting', call});
        if (this.pc) {
          await this.pc.setRemoteDescription(
            new RTCSessionDescription({type: 'answer', sdp: e.content.answer.sdp}),
          );
        }
        break;
      }

      case 'candidates': {
        const activeCall =
          this.state.status === 'connecting' || this.state.status === 'connected'
            ? this.state.call
            : null;
        if (!activeCall || e.content.call_id !== activeCall.callId) break;
        if (this.pc) {
          for (const c of e.content.candidates) {
            await this.pc.addIceCandidate(new RTCIceCandidate(c));
          }
        }
        break;
      }

      case 'hangup': {
        const s = this.state;
        if (s.status === 'idle' || s.status === 'ended') break;
        if (e.content.call_id !== s.call.callId) break;
        this.endCall(s.call, 'hangup');
        break;
      }

      case 'reject': {
        if (this.state.status !== 'ringing_out') break;
        if (e.content.call_id !== this.state.call.callId) break;
        this.endCall(this.state.call, 'rejected');
        break;
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildPeerConnection(call: ActiveCall, stream: MediaStream): RTCPeerConnection {
    const pc = this.createPc(this.iceConfig);
    this.pc = pc;

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Collect ICE candidates and send them in batches
    const pendingCandidates: RTCIceCandidateInit[] = [];
    let candidateFlushTimer: ReturnType<typeof setTimeout> | null = null;

    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const {candidate, sdpMid, sdpMLineIndex} = event.candidate;
      pendingCandidates.push({candidate, sdpMid, sdpMLineIndex});

      if (candidateFlushTimer) clearTimeout(candidateFlushTimer);
      candidateFlushTimer = setTimeout(() => {
        if (pendingCandidates.length === 0) return;
        const batch = pendingCandidates.splice(0);
        void this.signaling.sendCandidates(call.roomId, call.callId, batch);
      }, 200);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        if (
          this.state.status === 'connecting' &&
          this.state.call.callId === call.callId
        ) {
          this.transition({
            status: 'connected',
            call: {...call, startedAt: Date.now()},
          });
        }
      } else if (state === 'failed' || state === 'disconnected') {
        const s = this.state;
        if (
          (s.status === 'connecting' || s.status === 'connected') &&
          s.call.callId === call.callId
        ) {
          this.endCall(s.call, 'failed');
        }
      }
    };

    pc.ontrack = event => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.remoteStream = remoteStream;
        this.remoteStreamListeners.forEach(l => l(remoteStream));
      }
    };

    return pc;
  }

  private async acquireLocalMedia(preset: QualityPreset): Promise<MediaStream> {
    const constraints = QUALITY_PRESETS[preset];
    const stream = (await mediaDevices.getUserMedia({
      audio: constraints.audio,
      video: constraints.video || false,
    })) as unknown as MediaStream;

    this.localStream = stream;
    this.localStreamListeners.forEach(l => l(stream));
    return stream;
  }

  private endCall(call: ActiveCall, reason: EndReason): void {
    this.clearRingTimer();
    this.tearDownPc();
    this.transition({status: 'ended', call, reason});
  }

  private tearDownPc(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.remoteStream = null;
  }

  private startRingTimer(callId: string, roomId: string): void {
    this.clearRingTimer();
    this.ringTimer = setTimeout(() => {
      if (
        this.state.status === 'ringing_out' &&
        this.state.call.callId === callId
      ) {
        void this.signaling.sendHangup(roomId, callId, 'invite_timeout');
        this.endCall(this.state.call, 'timeout');
      }
    }, this.ringTimeoutMs);
  }

  private clearRingTimer(): void {
    if (this.ringTimer !== null) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  private transition(next: CallState): void {
    this.state = next;
    this.listeners.forEach(l => l(next));
  }
}

function generateCallId(): string {
  return `sauti-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
