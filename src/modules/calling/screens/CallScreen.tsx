import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {RTCView} from 'react-native-webrtc';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';
import {CallManager, CallState} from '../webrtc/CallManager';
import {useCall} from '../hooks/useCall';

export interface CallScreenProps {
  manager: CallManager;
  onCallEnded?(): void;
}

/**
 * Full-screen in-call UI.
 *
 * Renders:
 *  - Remote video (full-screen) or voice-only placeholder
 *  - Local video pip (top-right)
 *  - Call status label
 *  - Mute / camera-toggle / hang-up controls
 */
export function CallScreen({manager, onCallEnded}: CallScreenProps): React.JSX.Element {
  useScreenCaptureProtection(true);

  const {callState, localStream, remoteStream, answerCall, rejectCall, hangUp} =
    useCall(manager);

  const [muted, setMuted] = React.useState(false);
  const [cameraOn, setCameraOn] = React.useState(false);

  React.useEffect(() => {
    if (callState.status === 'ended') {
      onCallEnded?.();
    }
  }, [callState.status, onCallEnded]);

  const statusLabel = statusText(callState);

  return (
    <View style={styles.container} testID="call-screen">
      {/* Remote stream */}
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
            {callState.status !== 'idle' && callState.status !== 'ended'
              ? callState.call.peerId.slice(1, 2).toUpperCase()
              : '?'}
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

      {/* Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.statusLabel} testID="call-status-label">
          {statusLabel}
        </Text>

        {callState.status === 'ringing_in' ? (
          <View style={styles.incomingActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              accessibilityLabel="Reject call"
              onPress={rejectCall}>
              <Text style={styles.actionIcon}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.answerButton]}
              accessibilityLabel="Answer call"
              onPress={() => void answerCall()}>
              <Text style={styles.actionIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={[styles.actionButton, muted && styles.activeToggle]}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              onPress={() => setMuted(m => !m)}>
              <Text style={styles.actionIcon}>{muted ? '🔇' : '🎤'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.hangupButton]}
              accessibilityLabel="Hang up"
              onPress={hangUp}>
              <Text style={styles.actionIcon}>📵</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, cameraOn && styles.activeToggle]}
              accessibilityLabel={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              onPress={() => setCameraOn(c => !c)}>
              <Text style={styles.actionIcon}>{cameraOn ? '📷' : '📷'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

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
      const m = Math.floor(secs / 60)
        .toString()
        .padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
    case 'ended':
      return `Call ended — ${state.reason.replace('_', ' ')}`;
  }
}

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
  hangupButton: {backgroundColor: Colors.semantic.error, width: 72, height: 72, borderRadius: 36},
  activeToggle: {backgroundColor: 'rgba(255,255,255,0.5)'},
  actionIcon: {fontSize: 24},
  xl: {padding: Spacing.xl},
});
