import {NativeModules} from 'react-native';

import {
  AndroidVpnProxyManager,
  getNativeProxyDiagnostics,
  getNativeProxyModule,
  type NativeProxyDiagnostics,
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
      getDiagnostics: async () => ({
        status: 'disabled',
        isRunning: false,
        permissionRequired: false,
        lastError: null,
      }),
    };

    (NativeModules as Record<string, unknown>).SautiProxyModule = nativeModule;

    const resolved = getNativeProxyModule();
    expect(resolved).toBe(nativeModule);
    await expect(resolved!.getStatus()).resolves.toBe('disabled');
  });

  it('returns native diagnostics when bridge is available', async () => {
    const diagnostics: NativeProxyDiagnostics = {
      status: 'failed',
      isRunning: false,
      permissionRequired: true,
      lastError: 'VPN permission is required before enabling the proxy service.',
    };

    (NativeModules as Record<string, unknown>).SautiProxyModule = {
      init: async () => false,
      enable: async () => false,
      disable: async () => false,
      isEnabled: async () => false,
      getStatus: async () => 'failed',
      getDiagnostics: async () => diagnostics,
    };

    await expect(getNativeProxyDiagnostics()).resolves.toEqual(diagnostics);
  });

  it('android vpn proxy manager initializes from native module status', async () => {
    (NativeModules as Record<string, unknown>).SautiProxyModule = {
      init: async () => true,
      enable: async () => true,
      disable: async () => false,
      isEnabled: async () => true,
      getStatus: async () => 'connected',
      getDiagnostics: async () => ({
        status: 'connected',
        isRunning: true,
        permissionRequired: false,
        lastError: null,
      }),
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
