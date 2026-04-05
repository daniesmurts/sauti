import {SautiError} from '../src/core/matrix';
import {AuthApplicationService} from '../src/modules/auth';

describe('AuthApplicationService', () => {
  it('delegates register-and-bootstrap to orchestration service', async () => {
    const bootstrapService = {
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
          plan: 'free',
          status: 'active',
        },
      })),
      bootstrapFromStoredSession: jest.fn(),
    };

    const service = new AuthApplicationService(bootstrapService);

    const result = await service.registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
    });

    expect(bootstrapService.registerAndBootstrap).toHaveBeenCalledTimes(1);
    expect(result.startup.status).toBe('ready');
  });

  it('delegates stored-session resume to orchestration service', async () => {
    const bootstrapService = {
      registerAndBootstrap: jest.fn(),
      bootstrapFromStoredSession: jest.fn(async () => ({
        startup: {
          status: 'signed_out',
          reason: 'session_missing',
        },
        subscriptionStatus: null,
      })),
    };

    const service = new AuthApplicationService(bootstrapService);

    const result = await service.resumeFromStoredSession();

    expect(bootstrapService.bootstrapFromStoredSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      startup: {
        status: 'signed_out',
        reason: 'session_missing',
      },
      subscriptionStatus: null,
    });
  });

  it('wraps unknown errors into typed auth bootstrap failures', async () => {
    const service = new AuthApplicationService({
      registerAndBootstrap: jest.fn(async () => {
        throw new Error('unexpected failure');
      }),
      bootstrapFromStoredSession: jest.fn(),
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

  it('rethrows existing typed SautiErrors unchanged', async () => {
    const typed = new SautiError('AUTH_BOOTSTRAP_FAILED', 'typed');
    const service = new AuthApplicationService({
      registerAndBootstrap: jest.fn(async () => {
        throw typed;
      }),
      bootstrapFromStoredSession: jest.fn(),
    });

    await expect(
      service.registerAndBootstrap({
        phoneNumber: '+2348000000000',
        otpCode: '123456',
        password: 'strong-password',
      }),
    ).rejects.toBe(typed);
  });
});
