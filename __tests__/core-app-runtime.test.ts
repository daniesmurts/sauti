jest.mock('../src/core/db', () => ({
  createSautiDatabase: jest.fn(),
  WatermelonDbWiper: jest.fn().mockImplementation(database => ({database})),
}));

jest.mock('../src/core/messaging', () => ({
  createCoreMessagingRuntime: jest.fn(),
}));

jest.mock('../src/core/matrix', () => ({
  createDefaultMatrixLifecycleService: jest.fn(),
}));

import {createSautiDatabase} from '../src/core/db';
import {createDefaultMatrixLifecycleService} from '../src/core/matrix';
import {createCoreMessagingRuntime} from '../src/core/messaging';
import {createCoreAppRuntime} from '../src/core/runtime';

describe('createCoreAppRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('composes shared db, messaging, and lifecycle services and starts messaging when ready', async () => {
    const database = {db: 'shared'};
    (createSautiDatabase as jest.Mock).mockReturnValue(database);

    const messaging = {
      start: jest.fn(),
      stop: jest.fn(),
      getMatrixLifecycleOptions: jest.fn().mockReturnValue({
        timelineReconciliation: {
          start: jest.fn(),
          stop: jest.fn(),
        },
      }),
    };

    (createCoreMessagingRuntime as jest.Mock).mockReturnValue(messaging);

    const lifecycle = {
      start: jest.fn(async (_tokenStore, sessionProvider) => {
        await sessionProvider.getRequiredValidSession();
        return {
          status: 'ready',
          boot: {
            homeserverDomain: 'example.org',
            runtime: {},
          },
        };
      }),
      recover: jest.fn(async () => undefined),
      logout: jest.fn(async () => ({
        revokedSession: true,
        clearedSecureSession: true,
        wipedLocalDb: true,
      })),
    };

    (createDefaultMatrixLifecycleService as jest.Mock).mockReturnValue(lifecycle);

    const sessionStore = {
      getRequiredValidSession: jest.fn(async () => ({
        userId: '@alice:example.org',
        accessToken: 'token',
      })),
    };

    const runtime = createCoreAppRuntime({
      tokenStore: {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      sessionStore: sessionStore as never,
      currentUserIdFallback: () => '@fallback:example.org',
    });

    expect(createSautiDatabase).toHaveBeenCalledTimes(1);
    expect(createCoreMessagingRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        database,
        currentUserIdProvider: expect.any(Function),
      }),
    );

    const currentUserIdProvider = (createCoreMessagingRuntime as jest.Mock).mock
      .calls[0][0].currentUserIdProvider as () => string;

    expect(currentUserIdProvider()).toBe('@fallback:example.org');

    const result = await runtime.start();

    expect(result.status).toBe('ready');
    expect(sessionStore.getRequiredValidSession).toHaveBeenCalledTimes(1);
    expect(currentUserIdProvider()).toBe('@alice:example.org');
    expect(messaging.start).toHaveBeenCalledTimes(1);
    expect(messaging.stop).not.toHaveBeenCalled();
  });

  it('stops messaging and clears user identity when startup is signed out or logout occurs', async () => {
    const database = {db: 'shared'};
    (createSautiDatabase as jest.Mock).mockReturnValue(database);

    const messaging = {
      start: jest.fn(),
      stop: jest.fn(),
      getMatrixLifecycleOptions: jest.fn().mockReturnValue({
        timelineReconciliation: {
          start: jest.fn(),
          stop: jest.fn(),
        },
      }),
    };

    (createCoreMessagingRuntime as jest.Mock).mockReturnValue(messaging);

    const lifecycle = {
      start: jest.fn(async (_tokenStore, sessionProvider) => {
        await sessionProvider.getRequiredValidSession();
        return {
          status: 'signed_out',
          reason: 'session_missing',
        };
      }),
      recover: jest.fn(async () => undefined),
      logout: jest.fn(async () => ({
        revokedSession: true,
        clearedSecureSession: true,
        wipedLocalDb: true,
      })),
    };

    (createDefaultMatrixLifecycleService as jest.Mock).mockReturnValue(lifecycle);

    const runtime = createCoreAppRuntime({
      tokenStore: {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      sessionStore: {
        getRequiredValidSession: jest.fn(async () => ({
          userId: '@alice:example.org',
          accessToken: 'token',
        })),
      } as never,
      currentUserIdFallback: () => '@fallback:example.org',
    });

    const result = await runtime.start();

    expect(result).toEqual({status: 'signed_out', reason: 'session_missing'});
    expect(messaging.start).not.toHaveBeenCalled();
    expect(messaging.stop).toHaveBeenCalledTimes(1);
    expect(runtime.getCurrentUserId()).toBe('@fallback:example.org');

    await runtime.logout();
    expect(lifecycle.logout).toHaveBeenCalledTimes(1);
    expect(messaging.stop).toHaveBeenCalledTimes(2);
  });
});
