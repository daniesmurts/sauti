/**
 * Voice note tests.
 *
 * Covers:
 *  - VoiceNoteRecorder state machine (idle → recording → stopped / cancelled)
 *  - VoiceNotePlayer rendering and playback callbacks
 */

import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest, beforeEach} from '@jest/globals';
import AudioRecorderPlayer, {getLastInstance} from 'react-native-audio-recorder-player';

import {VoiceNoteRecorder} from '../src/modules/main/voicenote/VoiceNoteRecorder';
import {VoiceNotePlayer} from '../src/ui/components/VoiceNotePlayer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findByTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(n => n.props.testID === id)[0] ?? null;
}

// ── VoiceNoteRecorder ─────────────────────────────────────────────────────────

describe('VoiceNoteRecorder', () => {
  let arp: AudioRecorderPlayer & {
    _emitPlayback(pos: number, dur: number): void;
  };
  let recorder: VoiceNoteRecorder;

  beforeEach(() => {
    arp = new AudioRecorderPlayer() as typeof arp;
    recorder = new VoiceNoteRecorder(arp);
  });

  it('starts in idle state', () => {
    expect(recorder.getState()).toBe('idle');
  });

  it('transitions to recording after start()', async () => {
    await recorder.start();
    expect(recorder.getState()).toBe('recording');
    expect(arp.startRecorder).toHaveBeenCalledTimes(1);
  });

  it('second call to start() while recording is a no-op', async () => {
    await recorder.start();
    await recorder.start(); // should not throw or re-call startRecorder
    expect(arp.startRecorder).toHaveBeenCalledTimes(1);
    expect(recorder.getState()).toBe('recording');
  });

  it('transitions to stopped after stop() and returns filePath + durationMs', async () => {
    await recorder.start();
    const result = await recorder.stop();
    expect(recorder.getState()).toBe('stopped');
    expect(arp.stopRecorder).toHaveBeenCalledTimes(1);
    expect(result.filePath).toBe('file:///mock/voice-note.m4a');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('transitions to cancelled after cancel()', async () => {
    await recorder.start();
    await recorder.cancel();
    expect(recorder.getState()).toBe('cancelled');
    expect(arp.stopRecorder).toHaveBeenCalledTimes(1);
  });

  it('cancel() on idle state is a no-op', async () => {
    await recorder.cancel(); // should not throw
    expect(recorder.getState()).toBe('idle');
    expect(arp.stopRecorder).not.toHaveBeenCalled();
  });

  it('stop() on idle state throws', async () => {
    await expect(recorder.stop()).rejects.toThrow();
  });

  it('stop() on cancelled state throws', async () => {
    await recorder.start();
    await recorder.cancel();
    await expect(recorder.stop()).rejects.toThrow();
  });
});

// ── VoiceNotePlayer ───────────────────────────────────────────────────────────

describe('VoiceNotePlayer', () => {
  it('renders play button in idle state', () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={3500} direction="outgoing" />,
    );
    const btn = findByTestID(tree, 'voice-note-play-button');
    expect(btn).not.toBeNull();
    expect(btn?.props.accessibilityLabel).toBe('Play voice note');
  });

  it('shows formatted duration', () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={65000} direction="incoming" />,
    );
    const label = findByTestID(tree, 'voice-note-duration');
    expect(label?.props.children).toBe('1:05');
  });

  it('shows 0:00 for zero duration', () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={0} direction="incoming" />,
    );
    const label = findByTestID(tree, 'voice-note-duration');
    expect(label?.props.children).toBe('0:00');
  });

  it('switches to pause label after pressing play', async () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={5000} direction="outgoing" />,
    );
    // flush useEffect so arpRef.current is populated
    await act(async () => {});

    await act(async () => {
      findByTestID(tree, 'voice-note-play-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'voice-note-play-button')?.props.accessibilityLabel).toBe(
      'Pause voice note',
    );
  });

  it('switches back to play label after pressing pause', async () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={5000} direction="outgoing" />,
    );
    await act(async () => {}); // flush useEffect

    // play
    await act(async () => {
      findByTestID(tree, 'voice-note-play-button')?.props.onPress();
      await Promise.resolve();
    });
    // pause
    await act(async () => {
      findByTestID(tree, 'voice-note-play-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'voice-note-play-button')?.props.accessibilityLabel).toBe(
      'Play voice note',
    );
  });

  it('resets to idle when playback reaches end', async () => {
    const tree = renderer.create(
      <VoiceNotePlayer uri="file:///note.m4a" durationMs={2000} direction="incoming" />,
    );
    await act(async () => {}); // flush useEffect — arpRef.current is now set

    // start playback
    await act(async () => {
      findByTestID(tree, 'voice-note-play-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'voice-note-play-button')?.props.accessibilityLabel).toBe(
      'Pause voice note',
    );

    // emit end-of-stream via the mock instance created by the component
    const instance = getLastInstance() as AudioRecorderPlayer & {
      _emitPlayback(pos: number, dur: number): void;
    };
    await act(async () => {
      instance._emitPlayback(2000, 2000);
    });

    expect(findByTestID(tree, 'voice-note-play-button')?.props.accessibilityLabel).toBe(
      'Play voice note',
    );
  });
});
