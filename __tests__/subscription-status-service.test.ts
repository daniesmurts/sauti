jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  })),
}));

import {SubscriptionStatusService} from '../src/modules/subscription/api';

describe('SubscriptionStatusService', () => {
  it('returns cached status when available and valid', async () => {
    const secureStoreState = new Map<string, string>();
    secureStoreState.set(
      'subscription.status.v1.@alice:example.org',
      JSON.stringify({
        expiresAtMs: 10_000,
        value: {
          matrixUserId: '@alice:example.org',
          plan: 'family',
          status: 'active',
        },
      }),
    );

    const service = new SubscriptionStatusService({
      now: () => 1000,
      fetchFn: jest.fn() as unknown as typeof fetch,
      secureStore: {
        getItemAsync: jest.fn(async key => secureStoreState.get(key) ?? null),
        setItemAsync: jest.fn(async (key, value) => {
          secureStoreState.set(key, value);
        }),
        deleteItemAsync: jest.fn(async key => {
          secureStoreState.delete(key);
        }),
      },
    });

    const result = await service.getStatus('@alice:example.org');

    expect(result).toEqual({
      matrixUserId: '@alice:example.org',
      plan: 'family',
      status: 'active',
    });
  });

  it('fetches and caches subscription status when cache is stale', async () => {
    const secureStoreState = new Map<string, string>();

    const fetchFn = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        matrixUserId: '@alice:example.org',
        plan: 'free',
        status: 'active',
      }),
    })) as unknown as typeof fetch;

    const service = new SubscriptionStatusService({
      now: () => 1000,
      ttlMs: 500,
      fetchFn,
      secureStore: {
        getItemAsync: jest.fn(async key => secureStoreState.get(key) ?? null),
        setItemAsync: jest.fn(async (key, value) => {
          secureStoreState.set(key, value);
        }),
        deleteItemAsync: jest.fn(async key => {
          secureStoreState.delete(key);
        }),
      },
    });

    const result = await service.getStatus('@alice:example.org');

    expect(result).toEqual({
      matrixUserId: '@alice:example.org',
      plan: 'free',
      status: 'active',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/subscription-status',
      expect.objectContaining({method: 'POST'}),
    );

    const cachedRaw = secureStoreState.get('subscription.status.v1.@alice:example.org');
    expect(cachedRaw).toBeDefined();
  });

  it('rethrows fetch failures as typed subscription errors', async () => {
    const service = new SubscriptionStatusService({
      now: () => 1000,
      fetchFn: jest.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })) as unknown as typeof fetch,
      secureStore: {
        getItemAsync: jest.fn(async () => null),
        setItemAsync: jest.fn(async () => undefined),
        deleteItemAsync: jest.fn(async () => undefined),
      },
    });

    await expect(service.getStatus('@alice:example.org')).rejects.toMatchObject({
      code: 'SUBSCRIPTION_FETCH_FAILED',
      name: 'SautiError',
    });
  });
});
