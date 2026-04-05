import {MatrixRuntime} from '../src/core/matrix/MatrixRuntime';

describe('MatrixRuntime', () => {
  it('starts modules in the expected order', async () => {
    const order: string[] = [];

    const runtime = new MatrixRuntime({
      client: {
        connectToHomeserver: jest.fn(async () => {
          order.push('connect');
        }),
        initialize: jest.fn(() => {
          order.push('initialize');
          return {};
        }),
        reconnectAfterNetworkLoss: jest.fn(async () => {
          order.push('reconnect');
        }),
      },
      crypto: {
        initializeE2EE: jest.fn(async () => {
          order.push('initCrypto');
        }),
        ensureKeyBackup: jest.fn(async () => {
          order.push('keyBackup');
        }),
      },
      sync: {
        start: jest.fn(async () => {
          order.push('startSync');
        }),
        stop: jest.fn(() => {
          order.push('stopSync');
        }),
      },
    });

    await runtime.start({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token',
    });

    expect(order).toEqual([
      'connect',
      'initialize',
      'initCrypto',
      'keyBackup',
      'startSync',
    ]);
    expect(runtime.isStarted()).toBe(true);
  });

  it('throws typed runtime start error when crypto setup fails', async () => {
    const startSync = jest.fn(async () => undefined);

    const runtime = new MatrixRuntime({
      client: {
        connectToHomeserver: jest.fn(async () => undefined),
        initialize: jest.fn(() => ({})),
        reconnectAfterNetworkLoss: jest.fn(async () => undefined),
      },
      crypto: {
        initializeE2EE: jest.fn(async () => undefined),
        ensureKeyBackup: jest.fn(async () => {
          throw new Error('backup failed');
        }),
      },
      sync: {
        start: startSync,
        stop: jest.fn(),
      },
    });

    await expect(
      runtime.start({
        baseUrl: 'https://matrix.example.org',
        userId: '@alice:example.org',
        accessToken: 'token',
      }),
    ).rejects.toMatchObject({
      code: 'MATRIX_RUNTIME_START_FAILED',
      name: 'SautiError',
    });

    expect(startSync).not.toHaveBeenCalled();
  });

  it('recovers after network loss using the started baseUrl', async () => {
    const reconnectAfterNetworkLoss = jest.fn(async () => undefined);

    const runtime = new MatrixRuntime({
      client: {
        connectToHomeserver: jest.fn(async () => undefined),
        initialize: jest.fn(() => ({})),
        reconnectAfterNetworkLoss,
      },
      crypto: {
        initializeE2EE: jest.fn(async () => undefined),
        ensureKeyBackup: jest.fn(async () => undefined),
      },
      sync: {
        start: jest.fn(async () => undefined),
        stop: jest.fn(),
      },
    });

    await runtime.start({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token',
    });

    await runtime.recoverAfterNetworkLoss();

    expect(reconnectAfterNetworkLoss).toHaveBeenCalledWith(
      'https://matrix.example.org',
    );
  });

  it('initializes proxy before connecting to homeserver', async () => {
    const order: string[] = [];
    const proxyFetchFn = jest.fn();
    const initialize = jest.fn(() => {
      order.push('initialize');
      return {};
    });

    const runtime = new MatrixRuntime({
      proxy: {
        init: jest.fn(async () => {
          order.push('proxyInit');
        }),
        getFetchFn: () => proxyFetchFn as never,
        getStatus: () => 'connected',
      },
      client: {
        connectToHomeserver: jest.fn(async () => {
          order.push('connect');
        }),
        initialize,
        reconnectAfterNetworkLoss: jest.fn(async () => undefined),
      },
      crypto: {
        initializeE2EE: jest.fn(async () => {
          order.push('initCrypto');
        }),
        ensureKeyBackup: jest.fn(async () => {
          order.push('keyBackup');
        }),
      },
      sync: {
        start: jest.fn(async () => {
          order.push('startSync');
        }),
        stop: jest.fn(),
      },
    });

    await runtime.start({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token',
    });

    expect(order).toEqual([
      'proxyInit',
      'connect',
      'initialize',
      'initCrypto',
      'keyBackup',
      'startSync',
    ]);

    expect(initialize).toHaveBeenCalledWith({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token',
      fetchFn: proxyFetchFn,
    });

    expect(runtime.getProxyStatus()).toBe('connected');
  });
});
