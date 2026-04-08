/**
 * Jest manual mock for react-native-audio-recorder-player.
 * Placed in __mocks__/ so Jest auto-resolves it for any test that imports
 * 'react-native-audio-recorder-player'.
 */

type PlayBackListener = (e: {currentPosition: number; duration: number}) => void;

let _lastInstance: AudioRecorderPlayer | null = null;

/** Returns the most recently constructed AudioRecorderPlayer instance. */
export function getLastInstance(): AudioRecorderPlayer | null {
  return _lastInstance;
}

export default class AudioRecorderPlayer {
  private _listeners: PlayBackListener[] = [];

  constructor() {
    _lastInstance = this;
  }

  startRecorder = jest.fn().mockResolvedValue('file:///mock/voice-note.m4a');
  stopRecorder = jest.fn().mockResolvedValue('file:///mock/voice-note.m4a');
  startPlayer = jest.fn().mockResolvedValue('playing');
  stopPlayer = jest.fn().mockResolvedValue('stopped');
  pausePlayer = jest.fn().mockResolvedValue('paused');
  resumePlayer = jest.fn().mockResolvedValue('resumed');

  addPlayBackListener(cb: PlayBackListener): void {
    this._listeners.push(cb);
  }

  removePlayBackListener(cb: PlayBackListener): void {
    this._listeners = this._listeners.filter(l => l !== cb);
  }

  /** Test helper — fire a playback progress event. */
  _emitPlayback(currentPosition: number, duration: number): void {
    this._listeners.forEach(l => l({currentPosition, duration}));
  }
}
