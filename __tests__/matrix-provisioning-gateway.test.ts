jest.mock('../supabase/functions/_shared/env', () => ({
  readSupabaseFunctionEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    matrixProvisioningApiUrl: 'https://provisioning.example.com/register',
    matrixProvisioningApiToken: 'provisioning-token',
  })),
}));

import {createMatrixProvisioningGateway} from '../supabase/functions/_shared/matrixProvisioning';

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
});