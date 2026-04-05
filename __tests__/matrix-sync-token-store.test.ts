import {MatrixSyncSecureStoreTokenStore} from '../src/core/storage';

describe('MatrixSyncSecureStoreTokenStore', () => {
  it('loads and persists sync tokens in secure storage', async () => {
    const state = new Map<string, string>();
    const secureStore = {
      getItemAsync: jest.fn(async (key: string) => state.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
    };

    const store = new MatrixSyncSecureStoreTokenStore(secureStore);

    expect(await store.getSyncToken()).toBeNull();

    await store.saveSyncToken('since-123');

    expect(await store.getSyncToken()).toBe('since-123');
  });

  it('rethrows storage failures as typed sync-token errors', async () => {
    const store = new MatrixSyncSecureStoreTokenStore({
      getItemAsync: jest.fn(async () => {
        throw new Error('read failed');
      }),
      setItemAsync: jest.fn(async () => {
        throw new Error('write failed');
      }),
    });

    await expect(store.getSyncToken()).rejects.toMatchObject({
      code: 'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
      name: 'SautiError',
    });

    await expect(store.saveSyncToken('x')).rejects.toMatchObject({
      code: 'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
      name: 'SautiError',
    });
  });
});
