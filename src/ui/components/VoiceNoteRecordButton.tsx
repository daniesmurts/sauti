/**
 * VoiceNoteRecordButton — hold-to-record, slide-to-cancel UI control.
 *
 * Interaction model:
 *  - Press and hold: starts recording, shows elapsed timer + cancel hint.
 *  - Slide left ≥ CANCEL_THRESHOLD px while holding: cancels the recording.
 *  - Release (without cancelling): stops recording and calls onSend.
 */

import React from 'react';
import {PanResponder, StyleSheet, Text, View} from 'react-native';
import {VoiceNoteRecorder} from '../../modules/main/voicenote/VoiceNoteRecorder';
import {Colors, Radius, Spacing} from '../tokens';

const CANCEL_THRESHOLD = 80; // px slide-left distance to cancel

export interface VoiceNoteRecordButtonProps {
  onSend(filePath: string, durationMs: number): void;
  onRecordingStart?(): void;
  onRecordingCancel?(): void;
}

type ButtonState = 'idle' | 'recording' | 'cancelling';

export function VoiceNoteRecordButton({
  onSend,
  onRecordingStart,
  onRecordingCancel,
}: VoiceNoteRecordButtonProps): React.JSX.Element {
  const [state, setState] = React.useState<ButtonState>('idle');
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);

  const recorderRef = React.useRef<VoiceNoteRecorder | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = React.useCallback(async () => {
    const recorder = new VoiceNoteRecorder();
    recorderRef.current = recorder;
    setElapsedMs(0);
    setDragX(0);
    setState('recording');
    onRecordingStart?.();
    await recorder.start();
    timerRef.current = setInterval(() => {
      setElapsedMs(prev => prev + 100);
    }, 100);
  }, [onRecordingStart]);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const commitSend = React.useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.getState() !== 'recording') return;
    stopTimer();
    const result = await recorder.stop();
    setState('idle');
    onSend(result.filePath, result.durationMs);
  }, [stopTimer, onSend]);

  const commitCancel = React.useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopTimer();
    await recorder.cancel();
    setState('idle');
    setDragX(0);
    onRecordingCancel?.();
  }, [stopTimer, onRecordingCancel]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        void startRecording();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const dx = gestureState.dx;
        setDragX(dx);
        if (dx < -CANCEL_THRESHOLD) {
          setState(prev => (prev === 'recording' ? 'cancelling' : prev));
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx < -CANCEL_THRESHOLD) {
          void commitCancel();
        } else {
          void commitSend();
        }
      },
      onPanResponderTerminate: () => {
        void commitCancel();
      },
    }),
  ).current;

  return (
    <View style={styles.wrapper}>
      {state !== 'idle' ? (
        <View style={styles.hint} testID="voice-note-hint">
          <Text style={styles.hintText} testID="voice-note-elapsed">
            {formatDuration(elapsedMs)}
          </Text>
          <Text
            style={[styles.cancelHint, state === 'cancelling' && styles.cancelHintActive]}>
            {'← slide to cancel'}
          </Text>
        </View>
      ) : null}

      <View
        {...panResponder.panHandlers}
        testID="voice-note-record-button"
        accessibilityLabel={state === 'idle' ? 'Hold to record voice note' : 'Recording'}
        style={[
          styles.button,
          state === 'recording' && styles.buttonRecording,
          state === 'cancelling' && styles.buttonCancelling,
          dragX !== 0 && {transform: [{translateX: Math.min(0, dragX * 0.3)}]},
        ]}>
        <Text style={styles.icon}>{state === 'idle' ? '🎙' : '⏺'}</Text>
      </View>
    </View>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  hintText: {
    fontSize: 13,
    color: Colors.semantic.error,
    fontWeight: '600',
    minWidth: 36,
  },
  cancelHint: {
    fontSize: 12,
    color: Colors.neutral[400],
  },
  cancelHintActive: {
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRecording: {
    backgroundColor: Colors.semantic.errorBg,
  },
  buttonCancelling: {
    backgroundColor: Colors.neutral[200],
    opacity: 0.6,
  },
  icon: {
    fontSize: 20,
  },
});
