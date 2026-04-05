import {NoopProxyManager} from '../src/core/proxy';

describe('NoopProxyManager', () => {
  it('starts disabled and reports no HTTPS agent', async () => {
    const manager = new NoopProxyManager();

    await manager.init();

    expect(manager.getStatus()).toBe('disabled');
    expect(manager.isEnabled()).toBe(false);
    expect(manager.getHttpsAgent()).toBeNull();
  });

  it('transitions status on enable/disable', async () => {
    const manager = new NoopProxyManager();

    await manager.enable();
    expect(manager.isEnabled()).toBe(true);
    expect(manager.getStatus()).toBe('connected');

    await manager.disable();
    expect(manager.isEnabled()).toBe(false);
    expect(manager.getStatus()).toBe('disabled');
  });
});
