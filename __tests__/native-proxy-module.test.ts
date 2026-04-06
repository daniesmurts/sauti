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
      requestVpnPermission: async () => true,
    };

    (NativeModules as Record<string, unknown>).SautiProxyModule = nativeModule;

    const resolved = getNativeProxyModule();
    expect(resolved).toBe(nativeModule);
    await expect(resolved!.getStatus()).resolves.toBe('disabled');
  });

  it('returns null when requestVpnPermission method is absent from bridge', () => {
    (NativeModules as Record<string, unknown>).SautiProxyModule = {
      init: async () => true,
      enable: async () => true,
      disable: async () => false,
      isEnabled: async () => false,
      getStatus: async () => 'disabled',
      getDiagnostics: async () => ({status: 'disabled', isRunning: false, permissionRequired: false, lastError: null}),
      // requestVpnPermission intentionally omitted
    };

    expect(getNativeProxyModule()).toBeNull();
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
      requestVpnPermission: async () => false,
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
      requestVpnPermission: async () => true,
    };

    const manager = new AndroidVpnProxyManager();
    await manager.init();

    expect(manager.getStatus()).toBe('connected');
  });

  it('android vpn proxy manager requests permission then retries enable', async () => {
    let permissionGranted = false;
    let enableCallCount = 0;

    (NativeModules as Record<string, unknown>).SautiProxyModule = {
      init: async () => false,
      enable: async () => {
        enableCallCount += 1;
        if (!permissionGranted) {
          const err = Object.assign(new Error('VPN permission required'), {
            code: 'PROXY_PERMISSION_REQUIRED',
          });
          throw err;
        }
        return true;
      },
      disable: async () => false,
      isEnabled: async () => permissionGranted,
      getStatus: async () => (permissionGranted ? 'connected' : 'disabled'),
      getDiagnostics: async () => ({
        status: permissionGranted ? 'connected' : 'disabled',
        isRunning: permissionGranted,
        permissionRequired: !permissionGranted,
        lastError: null,
      }),
      requestVpnPermission: async () => {
        permissionGranted = true;
        return true;
      },
    };

    const manager = new AndroidVpnProxyManager();
    await manager.enable();

    expect(enableCallCount).toBe(2);
    expect(manager.getStatus()).toBe('connected');
  });

  it('android vpn proxy manager throws when native module is missing', async () => {
    const manager = new AndroidVpnProxyManager();

    await expect(manager.init()).rejects.toThrow('SautiProxyModule is unavailable.');
  });
});
