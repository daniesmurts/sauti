import {
  createDefaultProxyManager,
  NoopProxyManager,
  ResilientProxyManager,
} from '../src/core/proxy';

describe('createDefaultProxyManager', () => {
  it('returns ResilientProxyManager when valid fronting env exists', () => {
    const manager = createDefaultProxyManager({
      CF_FRONTING_HOST: 'cdn.cloudflare.com',
      CF_ORIGIN_HOST: 'matrix.example.org',
      CF_FRONTING_PUBLIC_KEY_HASHES:
        'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=,hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
    });

    expect(manager).toBeInstanceOf(ResilientProxyManager);
  });

  it('returns NoopProxyManager when fronting env is absent', () => {
    const manager = createDefaultProxyManager({});
    expect(manager).toBeInstanceOf(NoopProxyManager);
  });

  it('returns NoopProxyManager when fronting env is invalid', () => {
    const manager = createDefaultProxyManager({
      CF_FRONTING_HOST: 'cdn.cloudflare.com',
    });

    expect(manager).toBeInstanceOf(NoopProxyManager);
  });

  it('falls back to disabled/noop status when fronting manager init fails', async () => {
    const manager = createDefaultProxyManager({
      CF_FRONTING_HOST: 'bad host',
      CF_ORIGIN_HOST: 'matrix.example.org',
    });

    await manager.init();
    expect(manager.getStatus()).toBe('disabled');
  });
});
