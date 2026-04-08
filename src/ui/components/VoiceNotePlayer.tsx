/**
 * VoiceNotePlayer — inline playback bubble for m.audio messages.
 *
 * Renders a play/pause button, a progress bar, and a duration label.
 * Uses react-native-audio-recorder-player for playback.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {Colors, Radius, Spacing} from '../tokens';

export interface VoiceNotePlayerProps {
  uri: string;
  durationMs: number;
  direction: 'incoming' | 'outgoing';
  testID?: string;
}

export function VoiceNotePlayer({
  uri,
  durationMs,
  direction,
  testID,
}: VoiceNotePlayerProps): React.JSX.Element {
  const [playing, setPlaying] = React.useState(false);
  const [currentMs, setCurrentMs] = React.useState(0);
  const arpRef = React.useRef<AudioRecorderPlayer | null>(null);

  React.useEffect(() => {
    const arp = new AudioRecorderPlayer();
    arpRef.current = arp;
    return () => {
      arp.stopPlayer().catch(() => {});
    };
  }, []);

  const handlePlay = React.useCallback(async () => {
    const arp = arpRef.current;
    if (!arp) return;
    setPlaying(true);
    await arp.startPlayer(uri);
    arp.addPlayBackListener(e => {
      setCurrentMs(e.currentPosition);
      if (e.duration > 0 && e.currentPosition >= e.duration) {
        setPlaying(false);
        setCurrentMs(0);
      }
    });
  }, [uri]);

  const handlePause = React.useCallback(async () => {
    await arpRef.current?.stopPlayer();
    setPlaying(false);
  }, []);

  const isOutgoing = direction === 'outgoing';
  const totalMs = Math.max(durationMs, 1);
  const progress = Math.min(currentMs / totalMs, 1);

  return (
    <View style={styles.container} testID={testID ?? 'voice-note-player'}>
      <TouchableOpacity
        onPress={playing ? handlePause : handlePlay}
        accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
        testID="voice-note-play-button"
        style={styles.playButton}>
        <Text style={[styles.playIcon, isOutgoing ? styles.iconOut : styles.iconIn]}>
          {playing ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {flex: progress || 0.001},
            isOutgoing ? styles.fillOut : styles.fillIn,
          ]}
        />
        <View style={{flex: Math.max(1 - progress, 0.001)}} />
      </View>

      <Text
        style={[styles.duration, isOutgoing ? styles.durationOut : styles.durationIn]}
        testID="voice-note-duration">
        {formatDuration(playing ? currentMs : durationMs)}
      </Text>
    </View>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 180,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 14,
  },
  iconOut: {color: Colors.neutral[0]},
  iconIn: {color: Colors.brand[500]},
  track: {
    flex: 1,
    height: 3,
    flexDirection: 'row',
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  fill: {
    height: '100%',
  },
  fillOut: {backgroundColor: Colors.neutral[0]},
  fillIn: {backgroundColor: Colors.brand[500]},
  duration: {
    fontSize: 11,
    minWidth: 30,
    textAlign: 'right',
  },
  durationOut: {color: 'rgba(255,255,255,0.75)'},
  durationIn: {color: Colors.neutral[500]},
});
