import {startMatrixFromStoredSession} from '../src/core/matrix/MatrixStartup';
import {SautiError} from '../src/core/matrix';

jest.mock('../src/core/matrix/MatrixBoot', () => ({
  bootMatrixRuntimeFromSessionStore: jest.fn(),
}));

const {bootMatrixRuntimeFromSessionStore} = jest.requireMock(
  '../src/core/matrix/MatrixBoot',
) as {
  bootMatrixRuntimeFromSessionStore: jest.Mock;
};

describe('startMatrixFromStoredSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ready when runtime boots successfully', async () => {
    bootMatrixRuntimeFromSessionStore.mockResolvedValue({
      runtime: {isStarted: () => true},
      homeserverDomain: 'example.org',
    });

    const result = await startMatrixFromStoredSession(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn().mockResolvedValue({
          userId: '@alice:example.org',
          accessToken: 'token',
        }),
      },
    );

    expect(result).toMatchObject({
      status: 'ready',
      boot: {
        homeserverDomain: 'example.org',
      },
    });
  });

  it('returns signed_out when stored session is missing', async () => {
    bootMatrixRuntimeFromSessionStore.mockRejectedValue(
      new SautiError(
        'MATRIX_BOOT_FAILED',
        'boot failed',
        new SautiError('MATRIX_SESSION_MISSING', 'missing session'),
      ),
    );

    const result = await startMatrixFromStoredSession(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn(),
      },
    );

    expect(result).toEqual({
      status: 'signed_out',
      reason: 'session_missing',
    });
  });

  it('returns signed_out when stored session is expired', async () => {
    bootMatrixRuntimeFromSessionStore.mockRejectedValue(
      new SautiError(
        'MATRIX_BOOT_FAILED',
        'boot failed',
        new SautiError('MATRIX_SESSION_EXPIRED', 'expired session'),
      ),
    );

    const result = await startMatrixFromStoredSession(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn(),
      },
    );

    expect(result).toEqual({
      status: 'signed_out',
      reason: 'session_expired',
    });
  });

  it('returns signed_out when stored session is invalid', async () => {
    bootMatrixRuntimeFromSessionStore.mockRejectedValue(
      new SautiError(
        'MATRIX_BOOT_FAILED',
        'boot failed',
        new SautiError('MATRIX_SESSION_INVALID', 'invalid session'),
      ),
    );

    const result = await startMatrixFromStoredSession(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn(),
      },
    );

    expect(result).toEqual({
      status: 'signed_out',
      reason: 'session_invalid',
    });
  });

  it('throws typed startup error for non-session boot failures', async () => {
    bootMatrixRuntimeFromSessionStore.mockRejectedValue(
      new SautiError('MATRIX_BOOT_FAILED', 'network fail'),
    );

    await expect(
      startMatrixFromStoredSession(
        {
          getSyncToken: jest.fn().mockResolvedValue(null),
          saveSyncToken: jest.fn().mockResolvedValue(undefined),
        },
        {
          getRequiredValidSession: jest.fn(),
        },
      ),
    ).rejects.toMatchObject({
      code: 'MATRIX_STARTUP_FAILED',
      name: 'SautiError',
    });
  });
});
