jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  })),
}));

import {MatrixRegistrationService} from '../src/modules/auth/api';

describe('MatrixRegistrationService', () => {
  it('registers a Matrix account through Supabase edge function', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        userId: '@alice:example.org',
        accessToken: 'access-token',
        deviceId: 'DEVICE1',
        refreshToken: 'refresh-1',
        expiresInMs: 1000,
      }),
    })) as unknown as typeof fetch;

    const service = new MatrixRegistrationService(fetchFn);

    const result = await service.registerViaSupabase({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
      displayName: 'Alice',
    });

    expect(result).toEqual({
      userId: '@alice:example.org',
      accessToken: 'access-token',
      deviceId: 'DEVICE1',
      refreshToken: 'refresh-1',
      expiresInMs: 1000,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/register-matrix-user',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('rethrows registration failures as typed auth errors', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const service = new MatrixRegistrationService(fetchFn);

    await expect(
      service.registerViaSupabase({
        phoneNumber: '+2348000000000',
        otpCode: '123456',
        password: 'strong-password',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_REGISTRATION_FAILED',
      name: 'SautiError',
    });
  });

  it('surfaces structured edge function error messages', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 500,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        error:
          'Matrix provisioning integration not configured. Set MATRIX_PROVISIONING_API_URL to a service that creates Matrix users and returns credentials.',
      }),
      text: async () => '',
    })) as unknown as typeof fetch;

    const service = new MatrixRegistrationService(fetchFn);

    await expect(
      service.registerViaSupabase({
        phoneNumber: '+2348000000000',
        otpCode: '123456',
        password: 'strong-password',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_REGISTRATION_FAILED',
      message:
        'Matrix provisioning integration not configured. Set MATRIX_PROVISIONING_API_URL to a service that creates Matrix users and returns credentials.',
    });
  });
});
