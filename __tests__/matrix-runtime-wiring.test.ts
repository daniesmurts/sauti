import {createClient} from 'matrix-js-sdk';

import {createDefaultMatrixRuntime, matrixClient} from '../src/core/matrix';

jest.mock('matrix-js-sdk', () => ({
  createClient: jest.fn(),
}));

describe('createDefaultMatrixRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    matrixClient.resetForTests();
  });

  it('wires MatrixClient, MatrixSync, and MatrixRuntime for start/stop lifecycle', async () => {
    const startClient = jest.fn();
    const stopClient = jest.fn();
    const proxyInit = jest.fn(async () => undefined);

    (createClient as jest.Mock).mockReturnValue({
      startClient,
      stopClient,
      on: jest.fn(),
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ok: true, status: 200} as Response);

    const runtime = createDefaultMatrixRuntime({
      getSyncToken: jest.fn().mockResolvedValue('since-token'),
      saveSyncToken: jest.fn().mockResolvedValue(undefined),
    }, {
      proxyManager: {
        init: proxyInit,
        getStatus: () => 'disabled',
        getHttpsAgent: () => null,
        isEnabled: () => false,
        enable: async () => undefined,
        disable: async () => undefined,
      },
    });

    await runtime.start({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'access-token',
      enableE2EE: false,
      enableKeyBackup: false,
    });

    expect(createClient).toHaveBeenCalledWith({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'access-token',
      deviceId: undefined,
      fetchFn: undefined,
    });
    expect(startClient).toHaveBeenCalledWith({
      initialSyncLimit: 20,
      since: 'since-token',
    });
    expect(proxyInit).toHaveBeenCalledTimes(1);

    runtime.stop();
    expect(stopClient).toHaveBeenCalledTimes(1);

    fetchMock.mockRestore();
  });
});
