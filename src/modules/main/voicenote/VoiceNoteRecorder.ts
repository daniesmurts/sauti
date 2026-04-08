/**
 * VoiceNoteRecorder — thin state-machine wrapper around
 * react-native-audio-recorder-player.
 *
 * Audio settings: Opus-compatible AAC, 16 kbps mono, 16 kHz sample rate.
 * The instance is single-use: create a new one per recording session.
 */

import AudioRecorderPlayer from 'react-native-audio-recorder-player';

/** Numeric constants mirroring the library's Android enums (avoids importing them). */
const AudioEncoderAndroid = {
  AAC_ELD: 5,  // closest Android codec to Opus at low bitrate
} as const;

const AudioSourceAndroid = {
  MIC: 1,
} as const;

const VOICE_NOTE_AUDIO_SET = {
  // Android
  AudioEncoderAndroid: AudioEncoderAndroid.AAC_ELD,
  AudioSourceAndroid: AudioSourceAndroid.MIC,
  AudioSamplingRateAndroid: 16000,
  AudioChannelAndroid: 1,        // mono
  AudioEncodingBitRateAndroid: 16000, // 16 kbps
  // iOS
  AVSampleRateKeyIOS: 16000,
  AVNumberOfChannelsKeyIOS: 1,
  AVLinearPCMBitDepthKeyIOS: 16,
};

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'cancelled';

export interface VoiceNoteResult {
  filePath: string;
  durationMs: number;
}

export class VoiceNoteRecorder {
  private readonly _arp: AudioRecorderPlayer;
  private _state: RecorderState = 'idle';
  private _startedAt = 0;

  constructor(arp?: AudioRecorderPlayer) {
    this._arp = arp ?? new AudioRecorderPlayer();
  }

  getState(): RecorderState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state !== 'idle') return;
    this._state = 'recording';
    this._startedAt = Date.now();
    await this._arp.startRecorder(undefined, VOICE_NOTE_AUDIO_SET as Parameters<AudioRecorderPlayer['startRecorder']>[1]);
  }

  async stop(): Promise<VoiceNoteResult> {
    if (this._state !== 'recording') {
      throw new Error(`VoiceNoteRecorder.stop() called in state "${this._state}"`);
    }
    const durationMs = Date.now() - this._startedAt;
    const filePath = await this._arp.stopRecorder();
    this._state = 'stopped';
    return {filePath, durationMs};
  }

  async cancel(): Promise<void> {
    if (this._state !== 'recording') return;
    await this._arp.stopRecorder();
    this._state = 'cancelled';
  }
}
