import {AndroidProxyManager, IOSProxyManager} from '../src/core/proxy';

describe('Platform proxy manager adapters', () => {
  it('android adapter delegates to bridge methods and tracks status', async () => {
    let enabled = false;

    const manager = new AndroidProxyManager({
      init: async () => undefined,
      enable: async () => {
        enabled = true;
      },
      disable: async () => {
        enabled = false;
      },
      isEnabled: () => enabled,
    });

    await manager.init();
    expect(manager.getStatus()).toBe('disabled');

    await manager.enable();
    expect(manager.getStatus()).toBe('connected');

    await manager.disable();
    expect(manager.getStatus()).toBe('disabled');
  });

  it('ios adapter exposes optional bridge fetch function', async () => {
    const fetchFn = jest.fn();

    const manager = new IOSProxyManager({
      init: async () => undefined,
      enable: async () => undefined,
      disable: async () => undefined,
      isEnabled: () => true,
      getFetchFn: () => fetchFn as never,
    });

    await manager.init();

    expect(manager.getStatus()).toBe('connected');
    expect(manager.getFetchFn()).toBe(fetchFn);
  });
});
