import React from 'react';
import {MediaStream} from 'react-native-webrtc';
import {CallManager, CallState} from '../webrtc/CallManager';
import {QualityPreset} from '../webrtc/IceConfig';

/**
 * React hook that subscribes to a CallManager instance and exposes the
 * current call state plus action callbacks.
 *
 * The manager is created externally (e.g. in a context or singleton) and
 * passed in — this hook does not own the manager lifecycle.
 */
export function useCall(manager: CallManager): {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  placeCall(roomId: string, peerId: string, preset?: QualityPreset): Promise<void>;
  answerCall(preset?: QualityPreset): Promise<void>;
  rejectCall(): void;
  hangUp(): void;
} {
  const [callState, setCallState] = React.useState<CallState>(manager.getState);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = React.useState<MediaStream | null>(null);

  React.useEffect(() => {
    const unsub = manager.subscribe(setCallState);
    const unsubLocal = manager.onLocalStream(setLocalStream);
    const unsubRemote = manager.onRemoteStream(setRemoteStream);
    return () => {
      unsub();
      unsubLocal();
      unsubRemote();
    };
  }, [manager]);

  const placeCall = React.useCallback(
    (roomId: string, peerId: string, preset?: QualityPreset) =>
      manager.placeCall(roomId, peerId, preset),
    [manager],
  );

  const answerCall = React.useCallback(
    (preset?: QualityPreset) => manager.answerCall(preset),
    [manager],
  );

  const rejectCall = React.useCallback(() => manager.rejectCall(), [manager]);
  const hangUp = React.useCallback(() => manager.hangUp(), [manager]);

  return {callState, localStream, remoteStream, placeCall, answerCall, rejectCall, hangUp};
}
