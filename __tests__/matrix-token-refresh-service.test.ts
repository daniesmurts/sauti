import {MatrixTokenRefreshService} from '../src/core/matrix/MatrixTokenRefreshService';

jest.mock('../src/core/config/env', () => ({
  readMatrixEnv: jest.fn(),
}));

jest.mock('../src/core/matrix/MatrixClient', () => {
  const actual = jest.requireActual('../src/core/matrix/MatrixClient');
  return {
    ...actual,
    matrixClient: {
      ...actual.matrixClient,
      refreshAccessToken: jest.fn(),
    },
  };
});

const {readMatrixEnv} = jest.requireMock('../src/core/config/env') as {
  readMatrixEnv: jest.Mock;
};

const {matrixClient} = jest.requireMock('../src/core/matrix/MatrixClient') as {
  matrixClient: {
    refreshAccessToken: jest.Mock;
  };
};

describe('MatrixTokenRefreshService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes token and persists updated session when refresh token exists', async () => {
    const sessionStore = {
      loadSession: jest.fn().mockResolvedValue({
        userId: '@alice:example.org',
        accessToken: 'old-token',
        refreshToken: 'refresh-abc',
      }),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    readMatrixEnv.mockReturnValue({
      matrixHomeserverUrl: 'https://matrix.example.org',
      matrixHomeserverDomain: 'example.org',
    });
    matrixClient.refreshAccessToken.mockResolvedValue('new-token');

    const service = new MatrixTokenRefreshService(sessionStore as never, 1000);

    await service.refreshNow();

    expect(matrixClient.refreshAccessToken).toHaveBeenCalledWith(
      'https://matrix.example.org',
      'refresh-abc',
    );
    expect(sessionStore.saveSession).toHaveBeenCalledWith(
      {
        userId: '@alice:example.org',
        accessToken: 'new-token',
        refreshToken: 'refresh-abc',
      },
      1000,
    );
  });

  it('is a no-op when no refresh token is available', async () => {
    const sessionStore = {
      loadSession: jest.fn().mockResolvedValue({
        userId: '@alice:example.org',
        accessToken: 'old-token',
      }),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MatrixTokenRefreshService(sessionStore as never);

    await service.refreshNow();

    expect(matrixClient.refreshAccessToken).not.toHaveBeenCalled();
    expect(sessionStore.saveSession).not.toHaveBeenCalled();
  });

  it('throws typed lifecycle refresh error on failure', async () => {
    const sessionStore = {
      loadSession: jest.fn().mockRejectedValue(new Error('secure-store-failure')),
      saveSession: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MatrixTokenRefreshService(sessionStore as never);

    await expect(service.refreshNow()).rejects.toMatchObject({
      code: 'MATRIX_TOKEN_REFRESH_LIFECYCLE_FAILED',
      name: 'SautiError',
    });
  });
});
