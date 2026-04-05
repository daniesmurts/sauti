import NetInfo from '@react-native-community/netinfo';

export type AppNetworkState = 'connected' | 'disconnected' | 'degraded';

type NetworkListener = (state: AppNetworkState) => void;

interface NetInfoStateLike {
  isConnected?: boolean | null;
  details?: {
    downlinkMax?: number | null;
  } | null;
}

const DEGRADED_THRESHOLD_KBPS = 100;

function inferNetworkState(state: NetInfoStateLike): AppNetworkState {
  if (!state.isConnected) {
    return 'disconnected';
  }

  const downlinkMaxMbps = state.details?.downlinkMax;
  if (typeof downlinkMaxMbps === 'number') {
    const downlinkKbps = downlinkMaxMbps * 1000;
    if (downlinkKbps < DEGRADED_THRESHOLD_KBPS) {
      return 'degraded';
    }
  }

  return 'connected';
}

export class NetworkMonitor {
  private listeners = new Set<NetworkListener>();
  private currentState: AppNetworkState = 'disconnected';
  private unsubscribeNative: (() => void) | null = null;

  getState(): AppNetworkState {
    return this.currentState;
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.unsubscribeNative) {
      return;
    }

    this.unsubscribeNative = NetInfo.addEventListener(nativeState => {
      const nextState = inferNetworkState(nativeState as NetInfoStateLike);
      if (nextState === this.currentState) {
        return;
      }

      this.currentState = nextState;
      this.listeners.forEach(listener => {
        listener(nextState);
      });
    });
  }

  stop(): void {
    if (!this.unsubscribeNative) {
      return;
    }

    this.unsubscribeNative();
    this.unsubscribeNative = null;
  }
}
