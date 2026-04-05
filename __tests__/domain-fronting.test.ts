import {DomainFrontingProxyManager} from '../src/core/proxy';

describe('DomainFrontingProxyManager', () => {
  it('initializes to connected when enabled', async () => {
    const manager = new DomainFrontingProxyManager({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
    });

    await manager.init();

    expect(manager.getStatus()).toBe('connected');
    expect(manager.isEnabled()).toBe(true);
    expect(manager.getHttpsAgent()).toBeNull();
  });

  it('creates fetch wrapper with fronting headers', async () => {
    const manager = new DomainFrontingProxyManager({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
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
});
