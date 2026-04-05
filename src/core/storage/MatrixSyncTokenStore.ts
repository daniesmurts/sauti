import {MatrixSyncTokenStore} from '../matrix';
import {SautiError} from '../matrix/MatrixClient';

const MATRIX_SYNC_TOKEN_KEY = 'matrix.sync.token.v1';

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

function getDefaultSecureStore(): SecureStoreApi {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-secure-store') as SecureStoreApi;
  } catch {
    throw new SautiError(
      'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
      'SecureStore is unavailable for Matrix sync token storage.',
    );
  }
}

export class MatrixSyncSecureStoreTokenStore implements MatrixSyncTokenStore {
  constructor(private readonly secureStore: SecureStoreApi = getDefaultSecureStore()) {}

  async getSyncToken(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(MATRIX_SYNC_TOKEN_KEY);
    } catch (error) {
      throw new SautiError(
        'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
        'Failed to load Matrix sync token from SecureStore.',
        error,
      );
    }
  }

  async saveSyncToken(token: string): Promise<void> {
    try {
      await this.secureStore.setItemAsync(MATRIX_SYNC_TOKEN_KEY, token);
    } catch (error) {
      throw new SautiError(
        'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
        'Failed to persist Matrix sync token in SecureStore.',
        error,
      );
    }
  }
}
