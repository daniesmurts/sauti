/**
 * ICE / TURN configuration for WebRTC calls.
 *
 * Design constraints (from MASTER_SPEC §3.3):
 *  - iceTransportPolicy: 'relay'  — TURN-only.  Direct P2P is unreliable behind
 *    Russian DPI; forcing relay guarantees the TURN TCP:443 path is used.
 *  - TCP:443 is listed first so that it wins against UDP on restricted networks.
 *  - bundlePolicy: 'max-bundle' + rtcpMuxPolicy: 'require' minimise the number
 *    of TURN allocations (important for bandwidth-constrained 2G connections).
 */

export interface TurnCredentials {
  url: string;       // e.g. "turn:turn.sauti.ru:443"
  username: string;
  credential: string;
}

export interface RTCConfiguration {
  iceServers: RTCIceServer[];
  iceTransportPolicy: 'relay' | 'all';
  bundlePolicy: 'max-bundle' | 'balanced' | 'max-compat';
  rtcpMuxPolicy: 'require' | 'negotiate';
}

export interface RTCIceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Build RTCConfiguration.
 * Pass null to get a STUN-only 'all' policy config (dev/test fallback).
 */
export function buildIceConfig(creds: TurnCredentials | null): RTCConfiguration {
  if (!creds) {
    return {
      iceServers: [{urls: ['stun:stun.l.google.com:19302']}],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
  }

  // Derive the UDP fallback URL by replacing :443 with :3478
  const udpUrl = creds.url.replace(/:443$/, ':3478') + '?transport=udp';
  const tcpUrl = creds.url + '?transport=tcp';

  return {
    iceServers: [
      {
        urls: [tcpUrl, udpUrl],
        username: creds.username,
        credential: creds.credential,
      },
    ],
    iceTransportPolicy: 'relay',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

/**
 * Media constraint presets keyed by network quality.
 * Voice-only is the fallback for the worst conditions (2G / EDGE).
 */
export type QualityPreset = 'voice_only' | 'video_low' | 'video_medium' | 'video_high';

export interface MediaConstraints {
  audio: {
    sampleRate: number;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
  video:
    | false
    | {
        width: number;
        height: number;
        frameRate: number;
        facingMode: 'user' | 'environment';
      };
}

export const QUALITY_PRESETS: Record<QualityPreset, MediaConstraints> = {
  voice_only: {
    audio: {
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  },
  video_low: {
    // ~250 kbps — usable on 2G
    audio: {sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true},
    video: {width: 144, height: 176, frameRate: 10, facingMode: 'user'},
  },
  video_medium: {
    // ~600 kbps — 3G
    audio: {sampleRate: 48000, echoCancellation: true, noiseSuppression: true, autoGainControl: true},
    video: {width: 320, height: 240, frameRate: 15, facingMode: 'user'},
  },
  video_high: {
    // ~1.5 Mbps — 4G / WiFi
    audio: {sampleRate: 48000, echoCancellation: true, noiseSuppression: true, autoGainControl: true},
    video: {width: 640, height: 480, frameRate: 24, facingMode: 'user'},
  },
};

/** Map a rough network type string to a quality preset. */
export function presetForNetwork(
  networkType: 'wifi' | '4g' | '3g' | '2g' | 'offline' | 'unknown',
  videoEnabled: boolean,
): QualityPreset {
  if (!videoEnabled) return 'voice_only';
  switch (networkType) {
    case 'wifi':
    case '4g':
      return 'video_high';
    case '3g':
      return 'video_medium';
    default:
      return 'voice_only';
  }
}
