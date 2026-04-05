import {AuthBootstrapService} from '../src/modules/auth/api';

describe('AuthBootstrapService', () => {
  it('registers, saves session, starts runtime, and fetches subscription status', async () => {
    const register = jest.fn(async () => ({
      userId: '@alice:example.org',
      accessToken: 'access-token',
      deviceId: 'DEVICE1',
      refreshToken: 'refresh-1',
      expiresInMs: 1000,
    }));

    const saveSession = jest.fn(async () => undefined);
    const startRuntime = jest.fn(async () => ({
      status: 'ready',
      boot: {
        runtime: {},
        homeserverDomain: 'example.org',
      },
    }));

    const getSubscriptionStatus = jest.fn(async () => ({
      matrixUserId: '@alice:example.org',
      plan: 'family' as const,
      status: 'active' as const,
    }));

    const service = new AuthBootstrapService({
      register,
      saveSession,
      startRuntime,
      getSubscriptionStatus,
    });

    const result = await service.registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
      displayName: 'Alice',
    });

    expect(register).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledWith(
      {
        userId: '@alice:example.org',
        accessToken: 'access-token',
        deviceId: 'DEVICE1',
        refreshToken: 'refresh-1',
      },
      1000,
    );
    expect(startRuntime).toHaveBeenCalledTimes(1);
    expect(getSubscriptionStatus).toHaveBeenCalledWith('@alice:example.org');

    expect(result.subscriptionError).toBeUndefined();
    expect(result.subscriptionStatus).toEqual({
      matrixUserId: '@alice:example.org',
      plan: 'family',
      status: 'active',
    });
  });

  it('throws typed bootstrap error when runtime does not become ready', async () => {
    const service = new AuthBootstrapService({
      register: jest.fn(async () => ({
        userId: '@alice:example.org',
        accessToken: 'access-token',
        expiresInMs: 1000,
      })),
      saveSession: jest.fn(async () => undefined),
      startRuntime: jest.fn(async () => ({
        status: 'signed_out',
        reason: 'session_missing',
      })),
      getSubscriptionStatus: jest.fn(async () => ({
        matrixUserId: '@alice:example.org',
        plan: 'free',
        status: 'active',
      })),
    });

    await expect(
      service.registerAndBootstrap({
        phoneNumber: '+2348000000000',
        otpCode: '123456',
        password: 'strong-password',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_BOOTSTRAP_FAILED',
      name: 'SautiError',
    });
  });

  it('returns non-fatal subscription error while keeping successful bootstrap result', async () => {
    const service = new AuthBootstrapService({
      register: jest.fn(async () => ({
        userId: '@alice:example.org',
        accessToken: 'access-token',
        expiresInMs: 1000,
      })),
      saveSession: jest.fn(async () => undefined),
      startRuntime: jest.fn(async () => ({
        status: 'ready',
        boot: {
          runtime: {},
          homeserverDomain: 'example.org',
        },
      })),
      getSubscriptionStatus: jest.fn(async () => {
        throw new Error('subscription api unavailable');
      }),
    });

    const result = await service.registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
    });

    expect(result.startup.status).toBe('ready');
    expect(result.subscriptionStatus).toBeNull();
    expect(result.subscriptionError).toMatchObject({
      code: 'SUBSCRIPTION_FETCH_FAILED',
      name: 'SautiError',
    });
  });

  it('bootstraps from stored session and fetches subscription for returning users', async () => {
    const startRuntime = jest.fn(async () => ({
      status: 'ready',
      boot: {
        runtime: {},
        homeserverDomain: 'example.org',
      },
    }));
    const getStoredSession = jest.fn(async () => ({
      userId: '@alice:example.org',
    }));
    const getSubscriptionStatus = jest.fn(async () => ({
      matrixUserId: '@alice:example.org',
      plan: 'free' as const,
      status: 'active' as const,
    }));

    const service = new AuthBootstrapService({
      startRuntime,
      getStoredSession,
      getSubscriptionStatus,
      register: jest.fn(),
      saveSession: jest.fn(),
    });

    const result = await service.bootstrapFromStoredSession();

    expect(result.startup.status).toBe('ready');
    expect(getStoredSession).toHaveBeenCalledTimes(1);
    expect(getSubscriptionStatus).toHaveBeenCalledWith('@alice:example.org');
    expect(result.subscriptionError).toBeUndefined();
  });

  it('returns signed_out without subscription fetch when stored-session startup is not ready', async () => {
    const getSubscriptionStatus = jest.fn();

    const service = new AuthBootstrapService({
      startRuntime: jest.fn(async () => ({
        status: 'signed_out',
        reason: 'session_missing',
      })),
      getStoredSession: jest.fn(async () => null),
      getSubscriptionStatus,
      register: jest.fn(),
      saveSession: jest.fn(),
    });

    const result = await service.bootstrapFromStoredSession();

    expect(result).toEqual({
      startup: {status: 'signed_out', reason: 'session_missing'},
      subscriptionStatus: null,
    });
    expect(getSubscriptionStatus).not.toHaveBeenCalled();
  });
});
