import {
  MatrixLifecycleService,
  waitForLifecycleSnapshot,
} from '../src/core/matrix';

describe('Matrix lifecycle + wait integration', () => {
  it('waits until startup is ready and proxy is connected', async () => {
    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(async () => ({
        status: 'ready',
        boot: {
          homeserverDomain: 'example.org',
          runtime: {
            recoverAfterNetworkLoss: jest.fn(async () => undefined),
            getProxyStatus: () => 'connected',
          },
        },
      })),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
    });

    const waitPromise = waitForLifecycleSnapshot(
      service,
      snapshot =>
        snapshot.startupStatus === 'ready' &&
        snapshot.proxyStatus === 'connected',
      {timeoutMs: 1000},
    );

    await service.start(
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

    await expect(waitPromise).resolves.toMatchObject({
      startupStatus: 'ready',
      proxyStatus: 'connected',
    });
  });
});
