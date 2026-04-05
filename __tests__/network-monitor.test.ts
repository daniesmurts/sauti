import NetInfo from '@react-native-community/netinfo';

import {NetworkMonitor} from '../src/core/network';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
  },
}));

describe('NetworkMonitor', () => {
  it('emits connected and degraded states from NetInfo events', () => {
    let nativeListener: ((state: unknown) => void) | null = null;
    const unsubscribeNative = jest.fn();

    (NetInfo.addEventListener as jest.Mock).mockImplementation(listener => {
      nativeListener = listener;
      return unsubscribeNative;
    });

    const monitor = new NetworkMonitor();
    const seen: string[] = [];

    monitor.subscribe(state => {
      seen.push(state);
    });

    monitor.start();

    nativeListener?.({isConnected: true});
    nativeListener?.({isConnected: true, details: {downlinkMax: 0.05}});
    nativeListener?.({isConnected: false});

    expect(seen).toEqual(['connected', 'degraded', 'disconnected']);

    monitor.stop();
    expect(unsubscribeNative).toHaveBeenCalledTimes(1);
  });
});
