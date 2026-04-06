import {DomainFrontingProxyManager} from '../src/core/proxy';

describe('DomainFrontingProxyManager', () => {
  const pinningModule = jest.requireMock('react-native-ssl-public-key-pinning') as {
    initializeSslPinning: jest.Mock;
  };

  beforeEach(() => {
    pinningModule.initializeSslPinning.mockClear();
  });

  it('initializes to connected when enabled', async () => {
    const manager = new DomainFrontingProxyManager({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
      frontingPublicKeyHashes: [
        'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
        'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
      ],
    });

    await manager.init();

    expect(manager.getStatus()).toBe('connected');
    expect(manager.isEnabled()).toBe(true);
    expect(manager.getHttpsAgent()).toBeNull();
    expect(pinningModule.initializeSslPinning).toHaveBeenCalledWith({
      'cdn.cloudflare.com': {
        includeSubdomains: true,
        publicKeyHashes: [
          'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
          'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
        ],
      },
    });
  });

  it('creates fetch wrapper with fronting headers', async () => {
    const manager = new DomainFrontingProxyManager({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
      frontingPublicKeyHashes: [
        'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
        'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
      ],
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ok: true, status: 200} as Response);

    const frontedFetch = manager.getFetchFn();
    await frontedFetch('https://matrix.example.org/_matrix/client/versions', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.cloudflare.com/_matrix/client/versions',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          Host: 'matrix.example.org',
          'X-Sauti-Fronting-Host': 'cdn.cloudflare.com',
        }),
      }),
    );

    fetchMock.mockRestore();
  });

  it('rejects non-https URLs to prevent insecure fallback', async () => {
    const manager = new DomainFrontingProxyManager({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
      frontingPublicKeyHashes: [
        'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
        'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
      ],
    });

    const frontedFetch = manager.getFetchFn();
    await expect(
      frontedFetch('http://matrix.example.org/_matrix/client/versions'),
    ).rejects.toThrow('Domain-fronted transport requires HTTPS.');
  });
});
