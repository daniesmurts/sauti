import {MatrixAuthSessionStore} from '../src/core/storage/MatrixAuthSessionStore';

describe('MatrixAuthSessionStore', () => {
  it('saves and loads a valid session from secure store', async () => {
    const state = new Map<string, string>();
    const secureStore = {
      getItemAsync: jest.fn(async (key: string) => state.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      deleteItemAsync: jest.fn(async (key: string) => {
        state.delete(key);
      }),
    };

    const store = new MatrixAuthSessionStore(secureStore, () => 1000);

    await store.saveSession(
      {
        userId: '@alice:example.org',
        accessToken: 'token-123',
        deviceId: 'DEVICE1',
      },
      5000,
    );

    const loaded = await store.loadSession();

    expect(loaded).toEqual({
      userId: '@alice:example.org',
      accessToken: 'token-123',
      deviceId: 'DEVICE1',
    });
  });

  it('throws missing-session error when required session does not exist', async () => {
    const secureStore = {
      getItemAsync: jest.fn(async () => null),
      setItemAsync: jest.fn(async () => undefined),
      deleteItemAsync: jest.fn(async () => undefined),
    };

    const store = new MatrixAuthSessionStore(secureStore, () => 1000);

    await expect(store.getRequiredValidSession()).rejects.toMatchObject({
      code: 'MATRIX_SESSION_MISSING',
      name: 'SautiError',
    });
  });

  it('throws expired-session error when stored session is stale', async () => {
    const secureStore = {
      getItemAsync: jest.fn(async () =>
        JSON.stringify({
          userId: '@alice:example.org',
          accessToken: 'token-123',
          expiresAtMs: 1000,
        }),
      ),
      setItemAsync: jest.fn(async () => undefined),
      deleteItemAsync: jest.fn(async () => undefined),
    };

    const store = new MatrixAuthSessionStore(secureStore, () => 2000);

    await expect(store.loadSession()).rejects.toMatchObject({
      code: 'MATRIX_SESSION_EXPIRED',
      name: 'SautiError',
    });
  });

  it('throws invalid-session error when stored session JSON is malformed', async () => {
    const secureStore = {
      getItemAsync: jest.fn(async () => '{invalid-json'),
      setItemAsync: jest.fn(async () => undefined),
      deleteItemAsync: jest.fn(async () => undefined),
    };

    const store = new MatrixAuthSessionStore(secureStore, () => 1000);

    await expect(store.loadSession()).rejects.toMatchObject({
      code: 'MATRIX_SESSION_INVALID',
      name: 'SautiError',
    });
  });
});
