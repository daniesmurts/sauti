import {createAuthStore} from '../src/modules/auth';

describe('createAuthStore', () => {
  it('starts in idle state and can reset', () => {
    const store = createAuthStore({
      authService: {
        registerAndBootstrap: jest.fn(),
        resumeFromStoredSession: jest.fn(),
      } as never,
    });

    expect(store.getState().status).toBe('idle');

    store.setState({
      status: 'error',
      errorMessage: 'boom',
    });

    store.getState().reset();
    expect(store.getState()).toMatchObject({
      status: 'idle',
      reason: undefined,
      errorMessage: undefined,
    });
  });

  it('transitions to ready on successful registration bootstrap', async () => {
    const authService = {
      registerAndBootstrap: jest.fn(async () => ({
        registration: {
          userId: '@alice:example.org',
          accessToken: 'token',
          expiresInMs: 1000,
        },
        startup: {
          status: 'ready',
          boot: {
            runtime: {},
            homeserverDomain: 'example.org',
          },
        },
        subscriptionStatus: {
          matrixUserId: '@alice:example.org',
          plan: 'family' as const,
          status: 'active' as const,
        },
      })),
      resumeFromStoredSession: jest.fn(),
    };

    const store = createAuthStore({authService: authService as never});

    await store.getState().registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
    });

    expect(store.getState()).toMatchObject({
      status: 'ready',
      userId: '@alice:example.org',
      subscriptionPlan: 'family',
    });
  });

  it('transitions to signed_out on resume when startup result is signed_out', async () => {
    const authService = {
      registerAndBootstrap: jest.fn(),
      resumeFromStoredSession: jest.fn(async () => ({
        startup: {
          status: 'signed_out',
          reason: 'session_missing',
        },
        subscriptionStatus: null,
      })),
    };

    const store = createAuthStore({authService: authService as never});

    await store.getState().resumeFromStoredSession();

    expect(store.getState()).toMatchObject({
      status: 'signed_out',
      reason: 'session_missing',
      userId: undefined,
    });
  });

  it('transitions to error when auth orchestration throws', async () => {
    const authService = {
      registerAndBootstrap: jest.fn(async () => {
        throw new Error('registration failed');
      }),
      resumeFromStoredSession: jest.fn(),
    };

    const store = createAuthStore({authService: authService as never});

    await store.getState().registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
    });

    expect(store.getState()).toMatchObject({
      status: 'error',
      errorMessage: 'registration failed',
    });
  });

  it('uses fallback current user id when resume succeeds without subscription payload', async () => {
    const authService = {
      registerAndBootstrap: jest.fn(),
      resumeFromStoredSession: jest.fn(async () => ({
        startup: {
          status: 'ready',
          boot: {
            runtime: {},
            homeserverDomain: 'example.org',
          },
        },
        subscriptionStatus: null,
      })),
    };

    const store = createAuthStore({
      authService: authService as never,
      currentUserIdProvider: () => '@fallback:example.org',
    });

    await store.getState().resumeFromStoredSession();

    expect(store.getState()).toMatchObject({
      status: 'ready',
      userId: '@fallback:example.org',
      subscriptionPlan: undefined,
    });
  });
});
