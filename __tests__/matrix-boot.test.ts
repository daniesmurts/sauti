import {
  bootMatrixRuntime,
  bootMatrixRuntimeFromSessionStore,
} from '../src/core/matrix/MatrixBoot';

jest.mock('../src/core/config/env', () => ({
  readMatrixEnv: jest.fn(),
}));

jest.mock('../src/core/matrix/createMatrixRuntime', () => ({
  createDefaultMatrixRuntime: jest.fn(),
}));

const {readMatrixEnv} = jest.requireMock('../src/core/config/env') as {
  readMatrixEnv: jest.Mock;
};

const {createDefaultMatrixRuntime} = jest.requireMock(
  '../src/core/matrix/createMatrixRuntime',
) as {
  createDefaultMatrixRuntime: jest.Mock;
};

describe('bootMatrixRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts runtime from env and returns boot result', async () => {
    const runtimeStart = jest.fn(async () => undefined);
    const runtime = {
      start: runtimeStart,
    };

    readMatrixEnv.mockReturnValue({
      matrixHomeserverUrl: 'https://matrix.example.org',
      matrixHomeserverDomain: 'example.org',
    });
    createDefaultMatrixRuntime.mockReturnValue(runtime);

    const result = await bootMatrixRuntime(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        userId: '@alice:example.org',
        accessToken: 'token-123',
      },
    );

    expect(runtimeStart).toHaveBeenCalledWith({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token-123',
      deviceId: undefined,
    });

    expect(result.homeserverDomain).toBe('example.org');
  });

  it('throws typed boot error when env is invalid', async () => {
    readMatrixEnv.mockImplementation(() => {
      throw Object.assign(new Error('missing env'), {code: 'MATRIX_CONFIG_INVALID'});
    });

    await expect(
      bootMatrixRuntime(
        {
          getSyncToken: jest.fn().mockResolvedValue(null),
          saveSyncToken: jest.fn().mockResolvedValue(undefined),
        },
        {
          userId: '@alice:example.org',
          accessToken: 'token-123',
        },
      ),
    ).rejects.toMatchObject({
      code: 'MATRIX_BOOT_FAILED',
      name: 'SautiError',
    });
  });

  it('boots from session provider when secure session is available', async () => {
    const runtimeStart = jest.fn(async () => undefined);
    const runtime = {
      start: runtimeStart,
    };

    readMatrixEnv.mockReturnValue({
      matrixHomeserverUrl: 'https://matrix.example.org',
      matrixHomeserverDomain: 'example.org',
    });
    createDefaultMatrixRuntime.mockReturnValue(runtime);

    const result = await bootMatrixRuntimeFromSessionStore(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn().mockResolvedValue({
          userId: '@alice:example.org',
          accessToken: 'token-123',
          deviceId: 'DEVICE1',
        }),
      },
    );

    expect(runtimeStart).toHaveBeenCalledWith({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:example.org',
      accessToken: 'token-123',
      deviceId: 'DEVICE1',
    });
    expect(result.homeserverDomain).toBe('example.org');
  });

  it('throws typed boot error when session provider has no valid session', async () => {
    await expect(
      bootMatrixRuntimeFromSessionStore(
        {
          getSyncToken: jest.fn().mockResolvedValue(null),
          saveSyncToken: jest.fn().mockResolvedValue(undefined),
        },
        {
          getRequiredValidSession: jest.fn(async () => {
            throw Object.assign(new Error('session expired'), {
              code: 'MATRIX_SESSION_EXPIRED',
            });
          }),
        },
      ),
    ).rejects.toMatchObject({
      code: 'MATRIX_BOOT_FAILED',
      name: 'SautiError',
    });
  });
});
