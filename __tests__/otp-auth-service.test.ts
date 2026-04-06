jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  })),
}));

import {OtpAuthService} from '../src/modules/auth/api';

describe('OtpAuthService', () => {
  it('requests an otp through the Supabase edge function', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({
        requestId: 'otp-request-1',
        expiresInSeconds: 300,
      }),
    })) as unknown as typeof fetch;

    const service = new OtpAuthService(fetchFn);

    const result = await service.requestOtp({
      phoneNumber: '+2348000000000',
    });

    expect(result).toEqual({
      requestId: 'otp-request-1',
      expiresInSeconds: 300,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/request-otp',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('treats empty successful request-otp responses as accepted', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 204,
      headers: {
        get: jest.fn(() => null),
      },
      json: async () => undefined,
    })) as unknown as typeof fetch;

    const service = new OtpAuthService(fetchFn);

    await expect(
      service.requestOtp({phoneNumber: '+2348000000000'}),
    ).resolves.toEqual({});
  });

  it('verifies otp through the Supabase edge function', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({
        verified: true,
      }),
    })) as unknown as typeof fetch;

    const service = new OtpAuthService(fetchFn);

    const result = await service.verifyOtp({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      requestId: 'otp-request-1',
    });

    expect(result).toEqual({verified: true});
    expect(fetchFn).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/verify-otp',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('rethrows request failures as typed auth errors', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 500,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const service = new OtpAuthService(fetchFn);

    await expect(
      service.requestOtp({phoneNumber: '+2348000000000'}),
    ).rejects.toMatchObject({
      code: 'AUTH_OTP_REQUEST_FAILED',
      name: 'SautiError',
    });
  });

  it('rethrows verify failures as typed auth errors', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const service = new OtpAuthService(fetchFn);

    await expect(
      service.verifyOtp({
        phoneNumber: '+2348000000000',
        otpCode: '123456',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_OTP_VERIFY_FAILED',
      name: 'SautiError',
    });
  });
});