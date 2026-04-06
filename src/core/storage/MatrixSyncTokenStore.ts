import {MatrixSyncTokenStore} from '../matrix';

const MATRIX_SYNC_TOKEN_KEY = 'matrix.sync.token.v1';

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

type LocalSautiError = Error & {
  code: string;
  cause?: unknown;
};

function createSautiError(code: string, message: string, cause?: unknown): LocalSautiError {
  const error = new Error(message) as LocalSautiError;
  error.name = 'SautiError';
  error.code = code;
  if (typeof cause !== 'undefined') {
    error.cause = cause;
  }
  return error;
}

function createInMemorySecureStore(): SecureStoreApi {
  const data = new Map<string, string>();

  return {
    async getItemAsync(key: string): Promise<string | null> {
      return data.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string): Promise<void> {
      data.set(key, value);
    },
  };
}

function getDefaultSecureStore(): SecureStoreApi {
  const runtime = globalThis as {expo?: {EventEmitter?: unknown}};

  if (runtime.expo?.EventEmitter) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-secure-store') as SecureStoreApi;
    } catch {
      // Fall through to AsyncStorage fallback.
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asyncStorage = require('@react-native-async-storage/async-storage') as {
      default: {
        getItem(key: string): Promise<string | null>;
        setItem(key: string, value: string): Promise<void>;
      };
    };

    return {
      getItemAsync: key => asyncStorage.default.getItem(key),
      setItemAsync: (key, value) => asyncStorage.default.setItem(key, value),
    };
  } catch {
    return createInMemorySecureStore();
  }
}

export class MatrixSyncSecureStoreTokenStore implements MatrixSyncTokenStore {
  constructor(private readonly secureStore: SecureStoreApi = getDefaultSecureStore()) {}

  async getSyncToken(): Promise<string | null> {
    try {
      return await this.secureStore.getItemAsync(MATRIX_SYNC_TOKEN_KEY);
    } catch (error) {
      throw createSautiError(
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
      throw createSautiError(
        'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
        'Failed to persist Matrix sync token in SecureStore.',
        error,
      );
    }
  }
}
