jest.mock('../supabase/functions/_shared/env', () => ({
  readSupabaseFunctionEnv: jest.fn(),
}));

import {readSupabaseFunctionEnv} from '../supabase/functions/_shared/env';
import {createMatrixProvisioningGateway} from '../supabase/functions/_shared/matrixProvisioning';

const mockReadSupabaseFunctionEnv =
  readSupabaseFunctionEnv as jest.MockedFunction<typeof readSupabaseFunctionEnv>;

beforeEach(() => {
  jest.clearAllMocks();
  mockReadSupabaseFunctionEnv.mockReturnValue({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    matrixProvisioningApiUrl: 'https://provisioning.example.com/register',
    matrixProvisioningApiToken: 'provisioning-token',
  });
});

describe('createMatrixProvisioningGateway', () => {
  it('registers a user through the configured provisioning endpoint', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({
        userId: '@kwame:sauti.app',
        accessToken: 'access-token',
        deviceId: 'DEVICE1',
        refreshToken: 'refresh-token',
        expiresInMs: 3600000,
      }),
    })) as unknown as typeof fetch;

    const gateway = createMatrixProvisioningGateway(fetchFn);

    const result = await gateway.registerUser({
      phoneNumber: '+2348012345678',
      password: 'strong-password',
      displayName: 'Kwame Asante',
    });

    expect(result).toEqual({
      userId: '@kwame:sauti.app',
      accessToken: 'access-token',
      deviceId: 'DEVICE1',
      refreshToken: 'refresh-token',
      expiresInMs: 3600000,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://provisioning.example.com/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer provisioning-token',
        }),
      }),
    );
  });

  it('throws when the provisioning response is malformed', async () => {
    const fetchFn = jest.fn(async () => ({
      ok: true,
      headers: {
        get: jest.fn(() => 'application/json'),
      },
      json: async () => ({foo: 'bar'}),
    })) as unknown as typeof fetch;

    const gateway = createMatrixProvisioningGateway(fetchFn);

    await expect(
      gateway.registerUser({
        phoneNumber: '+2348012345678',
        password: 'strong-password',
      }),
    ).rejects.toThrow('Matrix provisioning payload is invalid.');
  });

  it('can provision directly through the Matrix admin API and then log in', async () => {
    mockReadSupabaseFunctionEnv.mockReturnValue({
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-role-key',
      matrixHomeserverUrl: 'https://matrix.sauti.ru',
      matrixHomeserverDomain: 'sauti.ru',
      matrixProvisioningApiToken: 'admin-token',
    });

    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: jest.fn(() => 'application/json'),
        },
        json: async () => ({
          user_id: '@u_1234567890abcdef123456:sauti.ru',
          access_token: 'matrix-access-token',
          device_id: 'DEVICE1',
          refresh_token: 'refresh-token',
          expires_in_ms: 3600000,
        }),
      }) as unknown as typeof fetch;

    const gateway = createMatrixProvisioningGateway(fetchFn);
    const result = await gateway.registerUser({
      phoneNumber: '+2348012345678',
      password: 'strong-password',
      displayName: 'Kwame Asante',
    });

    expect(result).toEqual({
      userId: '@u_1234567890abcdef123456:sauti.ru',
      accessToken: 'matrix-access-token',
      deviceId: 'DEVICE1',
      refreshToken: 'refresh-token',
      expiresInMs: 3600000,
    });
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('https://matrix.sauti.ru/_synapse/admin/v2/users/%40u_'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
        }),
      }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://matrix.sauti.ru/_matrix/client/v3/login',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});