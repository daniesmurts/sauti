import {NativeModules} from 'react-native';

import {
  AndroidVpnProxyManager,
  getNativeProxyModule,
  type NativeProxyModule,
} from '../src/core/proxy';

describe('NativeProxyModule bridge', () => {
  afterEach(() => {
    delete (NativeModules as Record<string, unknown>).SautiProxyModule;
  });

  it('returns null when native module is unavailable', () => {
    expect(getNativeProxyModule()).toBeNull();
  });

  it('returns typed module when native bridge exposes required methods', async () => {
    const nativeModule: NativeProxyModule = {
      init: async () => true,
      enable: async () => true,
      disable: async () => false,
      isEnabled: async () => false,
      getStatus: async () => 'disabled',
    };

    (NativeModules as Record<string, unknown>).SautiProxyModule = nativeModule;

    const resolved = getNativeProxyModule();
    expect(resolved).toBe(nativeModule);
    await expect(resolved!.getStatus()).resolves.toBe('disabled');
  });

  it('android vpn proxy manager initializes from native module status', async () => {
    (NativeModules as Record<string, unknown>).SautiProxyModule = {
      init: async () => true,
      enable: async () => true,
      disable: async () => false,
      isEnabled: async () => true,
      getStatus: async () => 'connected',
    };

    const manager = new AndroidVpnProxyManager();
    await manager.init();

    expect(manager.getStatus()).toBe('connected');
  });

  it('android vpn proxy manager throws when native module is missing', async () => {
    const manager = new AndroidVpnProxyManager();

    await expect(manager.init()).rejects.toThrow('SautiProxyModule is unavailable.');
  });
});
