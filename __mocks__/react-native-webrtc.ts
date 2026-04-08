/**
 * Jest manual mock for react-native-webrtc.
 * Placed in __mocks__/ so Jest auto-resolves it for any test that imports
 * 'react-native-webrtc'.
 */

export class MediaStreamTrack {
  readonly id = `mock-track-${Math.random().toString(36).slice(2)}`;
  readonly kind: 'audio' | 'video';
  enabled = true;
  stop = jest.fn();

  constructor(kind: 'audio' | 'video' = 'audio') {
    this.kind = kind;
  }
}

export class MediaStream {
  readonly id = `mock-stream-${Math.random().toString(36).slice(2)}`;
  private tracks: MediaStreamTrack[] = [];

  constructor(tracks?: MediaStreamTrack[]) {
    this.tracks = tracks ?? [];
  }

  getTracks(): MediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'audio');
  }

  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter(t => t.kind === 'video');
  }

  toURL(): string {
    return `mock-stream://${this.id}`;
  }
}

export class RTCPeerConnection {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  iceConnectionState: RTCIceConnectionState = 'new';
  signalingState: RTCSignalingState = 'stable';

  onicecandidate: ((event: {candidate: RTCIceCandidateInit | null}) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: {streams: MediaStream[]}) => void) | null = null;

  createOffer = jest.fn().mockResolvedValue({type: 'offer' as const, sdp: 'mock-offer-sdp'});
  createAnswer = jest.fn().mockResolvedValue({type: 'answer' as const, sdp: 'mock-answer-sdp'});

  setLocalDescription = jest.fn().mockImplementation((desc: RTCSessionDescriptionInit) => {
    this.localDescription = desc;
    return Promise.resolve();
  });

  setRemoteDescription = jest.fn().mockImplementation((desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = desc;
    return Promise.resolve();
  });

  addIceCandidate = jest.fn().mockResolvedValue(undefined);

  addTrack = jest.fn();

  close = jest.fn().mockImplementation(() => {
    this.iceConnectionState = 'closed';
  });

  getStats = jest.fn().mockResolvedValue(new Map());

  /** Test helper — simulate ICE connected state. */
  _simulateIceConnected(): void {
    this.iceConnectionState = 'connected';
    this.oniceconnectionstatechange?.();
  }

  /** Test helper — simulate ICE failed state. */
  _simulateIceFailed(): void {
    this.iceConnectionState = 'failed';
    this.oniceconnectionstatechange?.();
  }

  /** Test helper — fire an ICE candidate event. */
  _emitCandidate(candidate: RTCIceCandidateInit): void {
    this.onicecandidate?.({candidate});
  }

  /** Test helper — fire a remote track event. */
  _emitTrack(stream: MediaStream): void {
    this.ontrack?.({streams: [stream]});
  }
}

export class RTCSessionDescription {
  readonly type: string;
  readonly sdp: string;

  constructor(init: {type: string; sdp: string}) {
    this.type = init.type;
    this.sdp = init.sdp;
  }
}

export class RTCIceCandidate {
  readonly candidate: string;
  readonly sdpMid: string | null;
  readonly sdpMLineIndex: number | null;

  constructor(init: {candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null}) {
    this.candidate = init.candidate;
    this.sdpMid = init.sdpMid ?? null;
    this.sdpMLineIndex = init.sdpMLineIndex ?? null;
  }
}

export const mediaDevices = {
  getUserMedia: jest.fn().mockImplementation(
    (constraints?: {audio?: unknown; video?: unknown}) => {
      const tracks: MediaStreamTrack[] = [];
      if (constraints?.audio !== false) tracks.push(new MediaStreamTrack('audio'));
      if (constraints?.video && constraints.video !== false) tracks.push(new MediaStreamTrack('video'));
      if (tracks.length === 0) tracks.push(new MediaStreamTrack('audio'));
      return Promise.resolve(new MediaStream(tracks));
    },
  ),
};

// RTCView — renders nothing in tests
export const RTCView = 'RTCView';
