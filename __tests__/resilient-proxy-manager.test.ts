import {
  NoopProxyManager,
  ResilientProxyManager,
} from '../src/core/proxy';

describe('ResilientProxyManager', () => {
  it('keeps connected status when primary proxy initializes successfully', async () => {
    const primary = new NoopProxyManager();
    await primary.enable();

    const manager = new ResilientProxyManager(primary, new NoopProxyManager(), {
      allowDirectFallback: true,
    });

    await manager.init();

    expect(manager.getStatus()).toBe('connected');
  });

  it('falls back to noop when primary proxy init fails and fallback is allowed', async () => {
    const primary = {
      init: jest.fn(async () => {
        throw new Error('proxy unavailable');
      }),
      getStatus: () => 'failed' as const,
      getHttpsAgent: () => null,
      getFetchFn: () => undefined,
      isEnabled: () => false,
      enable: async () => undefined,
      disable: async () => undefined,
    };

    const fallback = new NoopProxyManager();

    const manager = new ResilientProxyManager(primary, fallback, {
      allowDirectFallback: true,
    });

    await manager.init();

    expect(primary.init).toHaveBeenCalledTimes(1);
    expect(manager.getStatus()).toBe('disabled');
  });

  it('throws when primary proxy init fails and fallback is disabled', async () => {
    const primary = {
      init: jest.fn(async () => {
        throw new Error('proxy unavailable');
      }),
      getStatus: () => 'failed' as const,
      getHttpsAgent: () => null,
      getFetchFn: () => undefined,
      isEnabled: () => false,
      enable: async () => undefined,
      disable: async () => undefined,
    };

    const manager = new ResilientProxyManager(primary, new NoopProxyManager(), {
      allowDirectFallback: false,
    });

    await expect(manager.init()).rejects.toThrow(
      'Primary proxy init failed and direct fallback is disabled.',
    );
  });
});
