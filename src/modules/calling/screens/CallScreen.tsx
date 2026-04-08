/**
 * CallScreen — full-screen in-call UI.
 *
 * Features:
 *  - Remote video (full-screen) or voice-only avatar placeholder
 *  - Local video PiP (top-right corner)
 *  - Network quality indicator (signal bars)
 *  - Downgrade-to-voice banner when network quality drops during a video call
 *  - Track-level mute (disables audio tracks without stopping them)
 *  - Track-level camera toggle (disables video tracks without stopping them)
 *  - Hang-up control
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import type {MediaStream} from 'react-native-webrtc';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';
import {CallManager, CallState} from '../webrtc/CallManager';
import {useCall} from '../hooks/useCall';
import {useNetworkQuality, NetworkQuality} from '../hooks/useNetworkQuality';

export interface CallScreenProps {
  manager: CallManager;
  onCallEnded?(): void;
}

// ── Track helpers ─────────────────────────────────────────────────────────────

type TrackLike = {enabled: boolean};
type StreamWithTracks = {
  getAudioTracks?(): TrackLike[];
  getVideoTracks?(): TrackLike[];
};

function setAudioEnabled(stream: MediaStream, enabled: boolean): void {
  (stream as unknown as StreamWithTracks).getAudioTracks?.().forEach(t => {
    t.enabled = enabled;
  });
}

function setVideoEnabled(stream: MediaStream, enabled: boolean): void {
  (stream as unknown as StreamWithTracks).getVideoTracks?.().forEach(t => {
    t.enabled = enabled;
  });
}

// ── Network quality indicator ─────────────────────────────────────────────────

function qualityColor(quality: NetworkQuality): string {
  switch (quality) {
    case 'wifi':
    case '4g':
      return Colors.semantic.success;
    case '3g':
      return Colors.semantic.warning;
    case '2g':
    case 'offline':
      return Colors.semantic.error;
    default:
      return Colors.neutral[400];
  }
}

function qualityBarHeights(quality: NetworkQuality): [number, number, number] {
  switch (quality) {
    case 'wifi':
    case '4g':
      return [6, 10, 14];
    case '3g':
      return [6, 10, 5];
    case '2g':
      return [6, 4, 4];
    case 'offline':
      return [3, 3, 3];
    default:
      return [4, 4, 4];
  }
}

function NetworkQualityIndicator({quality}: {quality: NetworkQuality}): React.JSX.Element {
  const color = qualityColor(quality);
  const [h1, h2, h3] = qualityBarHeights(quality);
  const dim = Colors.neutral[600];

  return (
    <View style={indicatorStyles.row} testID="network-quality-indicator">
      <View style={[indicatorStyles.bar, {height: h1, backgroundColor: quality !== 'unknown' ? color : dim}]} />
      <View style={[indicatorStyles.bar, {height: h2, backgroundColor: quality === 'wifi' || quality === '4g' || quality === '3g' ? color : dim}]} />
      <View style={[indicatorStyles.bar, {height: h3, backgroundColor: quality === 'wifi' || quality === '4g' ? color : dim}]} />
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'flex-end', gap: 2},
  bar: {width: 4, borderRadius: 2},
});

// ── CallScreen ────────────────────────────────────────────────────────────────

export function CallScreen({manager, onCallEnded}: CallScreenProps): React.JSX.Element {
  useScreenCaptureProtection(true);

  const {callState, localStream, remoteStream, answerCall, rejectCall, hangUp} =
    useCall(manager);

  const [muted, setMuted] = React.useState(false);
  const [cameraOn, setCameraOn] = React.useState(false);
  const [downgradeDismissed, setDowngradeDismissed] = React.useState(false);

  const {networkQuality, recommendedPreset} = useNetworkQuality(cameraOn);

  // Close screen when call ends
  React.useEffect(() => {
    if (callState.status === 'ended') {
      onCallEnded?.();
    }
  }, [callState.status, onCallEnded]);

  // Reset downgrade dismissal when quality recovers
  React.useEffect(() => {
    if (networkQuality !== '2g' && networkQuality !== 'offline') {
      setDowngradeDismissed(false);
    }
  }, [networkQuality]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleMute = React.useCallback(() => {
    if (localStream) {
      setAudioEnabled(localStream, muted); // muted=true → re-enable; muted=false → disable
    }
    setMuted(m => !m);
  }, [localStream, muted]);

  const handleToggleCamera = React.useCallback(() => {
    const next = !cameraOn;
    if (localStream) {
      setVideoEnabled(localStream, next);
    }
    setCameraOn(next);
  }, [localStream, cameraOn]);

  const handleDowngradeToVoice = React.useCallback(() => {
    if (localStream) {
      setVideoEnabled(localStream, false);
    }
    setCameraOn(false);
    setDowngradeDismissed(true);
  }, [localStream]);

  // ── Derived UI state ───────────────────────────────────────────────────────

  const isActive =
    callState.status === 'connecting' || callState.status === 'connected';

  const showDowngradeBanner =
    isActive &&
    cameraOn &&
    recommendedPreset === 'voice_only' &&
    !downgradeDismissed;

  const statusLabel = statusText(callState);

  const peerInitial =
    callState.status !== 'idle' && callState.status !== 'ended'
      ? callState.call.peerId.slice(1, 2).toUpperCase()
      : '?';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container} testID="call-screen">
      {/* Remote stream / voice placeholder */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          testID="remote-video"
        />
      ) : (
        <View style={styles.voicePlaceholder}>
          <Text style={styles.peerInitial} testID="voice-placeholder">
            {peerInitial}
          </Text>
        </View>
      )}

      {/* Local PiP */}
      {localStream && cameraOn ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror
          testID="local-video"
        />
      ) : null}

      {/* Downgrade suggestion banner */}
      {showDowngradeBanner ? (
        <View style={styles.downgradeBanner} testID="downgrade-banner">
          <Text style={styles.downgradeBannerText}>
            Poor connection — switch to voice only?
          </Text>
          <View style={styles.downgradeBannerActions}>
            <TouchableOpacity
              style={styles.downgradeDismiss}
              accessibilityLabel="Keep video"
              onPress={() => setDowngradeDismissed(true)}
              testID="downgrade-dismiss-button">
              <Text style={styles.downgradeDismissText}>Keep video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.downgradeConfirm}
              accessibilityLabel="Switch to voice"
              onPress={handleDowngradeToVoice}
              testID="downgrade-confirm-button">
              <Text style={styles.downgradeConfirmText}>Voice only</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Overlay — status + controls */}
      <View style={styles.overlay}>
        {/* Top row: network quality + status */}
        <View style={styles.statusRow}>
          <NetworkQualityIndicator quality={networkQuality} />
          <Text style={styles.statusLabel} testID="call-status-label">
            {statusLabel}
          </Text>
        </View>

        {/* Action buttons */}
        {callState.status === 'ringing_in' ? (
          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              accessibilityLabel="Reject call"
              onPress={rejectCall}
              testID="reject-call-button">
              <Text style={styles.actionIcon}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.answerButton]}
              accessibilityLabel="Answer call"
              onPress={() => void answerCall()}
              testID="answer-call-button">
              <Text style={styles.actionIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={[styles.actionButton, muted && styles.activeToggle]}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              onPress={handleToggleMute}
              testID="mute-button">
              <Text style={styles.actionIcon}>{muted ? '🔇' : '🎤'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.hangupButton]}
              accessibilityLabel="Hang up"
              onPress={hangUp}
              testID="hangup-button">
              <Text style={styles.actionIcon}>📵</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, cameraOn && styles.activeToggle]}
              accessibilityLabel={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              onPress={handleToggleCamera}
              testID="camera-button">
              <Text style={styles.actionIcon}>📷</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Status text ───────────────────────────────────────────────────────────────

function statusText(state: CallState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'ringing_out':
      return 'Calling…';
    case 'ringing_in':
      return `Incoming call from ${state.call.peerId}`;
    case 'connecting':
      return 'Connecting…';
    case 'connected': {
      if (!state.call.startedAt) return 'Connected';
      const secs = Math.floor((Date.now() - state.call.startedAt) / 1000);
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
    case 'ended':
      return `Call ended — ${state.reason.replace('_', ' ')}`;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
  remoteVideo: {flex: 1},
  voicePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[900],
  },
  peerInitial: {
    fontSize: 80,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  localVideo: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    width: 90,
    height: 130,
    borderRadius: 8,
    overflow: 'hidden',
  },
  downgradeBanner: {
    position: 'absolute',
    top: 56,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(220,38,38,0.92)',
    borderRadius: 10,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  downgradeBannerText: {
    ...TextPresets.body,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
  downgradeBannerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  downgradeDismiss: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  downgradeDismissText: {
    ...TextPresets.caption,
    color: Colors.neutral[0],
  },
  downgradeConfirm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Colors.neutral[0],
  },
  downgradeConfirmText: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusLabel: {
    ...TextPresets.body,
    color: Colors.neutral[0],
    textAlign: 'center',
  },
  incomingActions: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  activeActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    alignItems: 'center',
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {backgroundColor: Colors.semantic.error},
  answerButton: {backgroundColor: Colors.semantic.success},
  hangupButton: {
    backgroundColor: Colors.semantic.error,
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  activeToggle: {backgroundColor: 'rgba(255,255,255,0.5)'},
  actionIcon: {fontSize: 24},
});
