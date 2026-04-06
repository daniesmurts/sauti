jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  })),
}));

const mockAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  getSession: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
  mfa: {
    enroll: jest.fn(),
    challenge: jest.fn(),
    verify: jest.fn(),
  },
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: mockAuth,
  })),
}));

import {AfriLinkError} from '../src/core/errors';
import {AuthService} from '../src/core/auth/AuthService';

describe('AuthService', () => {
  const secureStore = {
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies email OTP and returns persisted session', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 1234,
          user: {
            id: 'user-1',
            email: 'name@example.com',
          },
        },
      },
      error: null,
    });

    const service = new AuthService({secureStore});
    const result = await service.verifyEmailOtp('name@example.com', '123456');

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1234,
      user: {
        id: 'user-1',
        email: 'name@example.com',
      },
    });
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_session',
      JSON.stringify(result),
    );
  });

  it('maps expired otp errors to OTP_EXPIRED', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: {session: null},
      error: new Error('OTP expired'),
    });

    const service = new AuthService({secureStore});

    await expect(
      service.verifyEmailOtp('name@example.com', '123456'),
    ).rejects.toMatchObject<Partial<AfriLinkError>>({
      code: 'OTP_EXPIRED',
      name: 'AfriLinkError',
    });
  });
});