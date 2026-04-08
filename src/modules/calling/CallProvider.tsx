/**
 * CallProvider — React context that owns the CallManager / CallSignaling /
 * CallKeepService lifecycle for the authenticated app session.
 *
 * Usage:
 *   <CallProvider localUserId="@alice:sauti.test" transport={matrixClient}>
 *     <YourNavigator />
 *   </CallProvider>
 *
 * Children receive the CallManager via useCallContext() and the provider
 * automatically renders the IncomingCallScreen and CallScreen overlays.
 */

import React from 'react';
import {View, StyleSheet} from 'react-native';

import {readTurnEnv} from '../../core/config/env';
import {buildIceConfig, type TurnCredentials} from './webrtc/IceConfig';
import {CallManager} from './webrtc/CallManager';
import {CallSignaling, type CallSignalingTransport} from './webrtc/CallSignaling';
import {CallKeepService} from './webrtc/CallKeepService';
import {useCall} from './hooks/useCall';
import {IncomingCallScreen} from './screens/IncomingCallScreen';
import {CallScreen} from './screens/CallScreen';

// ── Context ──────────────────────────────────────────────────────────────────

interface CallContextValue {
  manager: CallManager;
}

const CallContext = React.createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
  const ctx = React.useContext(CallContext);
  if (!ctx) {
    throw new Error('useCallContext must be used inside <CallProvider>');
  }
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export interface CallProviderProps {
  localUserId: string;
  transport: CallSignalingTransport;
  appName?: string;
  children: React.ReactNode;
  /** Override for tests — skip CallKeepService initialization. */
  disableCallKeep?: boolean;
}

export function CallProvider({
  localUserId,
  transport,
  appName = 'Sauti',
  children,
  disableCallKeep = false,
}: CallProviderProps): React.JSX.Element {
  // Build ICE config from env — falls back to STUN-only if TURN vars absent
  const iceConfig = React.useMemo(() => {
    let turnCreds: TurnCredentials | null = null;
    try {
      const env = readTurnEnv();
      if (env) {
        turnCreds = {
          url: env.turnServerUrl,
          username: env.turnUsername,
          credential: env.turnCredential,
        };
      }
    } catch {
      // swallow — fall through to STUN-only
    }
    return buildIceConfig(turnCreds);
  }, []);

  // CallSignaling and CallManager are stable for the lifetime of this provider
  const signalingRef = React.useRef<CallSignaling | null>(null);
  const managerRef = React.useRef<CallManager | null>(null);
  const callKeepRef = React.useRef<CallKeepService | null>(null);

  if (!signalingRef.current) {
    signalingRef.current = new CallSignaling(transport);
  }
  if (!managerRef.current) {
    managerRef.current = new CallManager({
      iceConfig,
      signaling: signalingRef.current,
      localUserId,
    });
  }

  React.useEffect(() => {
    if (!disableCallKeep && !callKeepRef.current && managerRef.current) {
      callKeepRef.current = new CallKeepService(managerRef.current, {appName});
    }

    return () => {
      callKeepRef.current?.destroy();
      callKeepRef.current = null;
      managerRef.current?.destroy();
      managerRef.current = null;
      signalingRef.current?.destroy();
      signalingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ctxValue = React.useMemo<CallContextValue>(
    () => ({manager: managerRef.current!}),
    [],
  );

  return (
    <CallContext.Provider value={ctxValue}>
      <View style={styles.fill}>
        {children}
        <CallOverlay manager={managerRef.current!} />
      </View>
    </CallContext.Provider>
  );
}

// ── Overlay ──────────────────────────────────────────────────────────────────

/**
 * Renders either the IncomingCallScreen or CallScreen on top of the app when
 * a call is active.  Dismissed automatically when the call ends.
 */
function CallOverlay({manager}: {manager: CallManager}): React.JSX.Element | null {
  const {callState, answerCall, rejectCall, hangUp} = useCall(manager);

  if (callState.status === 'idle') return null;
  if (callState.status === 'ended') return null;

  if (callState.status === 'ringing_in') {
    return (
      <IncomingCallScreen
        callerId={callState.call.peerId}
        onAnswer={() => void answerCall()}
        onReject={rejectCall}
      />
    );
  }

  // ringing_out | connecting | connected — show the full call screen
  return <CallScreen manager={manager} />;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: {flex: 1},
});
