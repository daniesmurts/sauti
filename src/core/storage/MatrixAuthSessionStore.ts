import {MatrixAuthSession} from '../matrix/MatrixBoot';

const MATRIX_AUTH_SESSION_KEY = 'matrix.auth.session.v1';

interface StoredMatrixAuthSession extends MatrixAuthSession {
  expiresAtMs: number;
}

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
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

function isSautiError(error: unknown): error is LocalSautiError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {name?: unknown; code?: unknown};
  return candidate.name === 'SautiError' && typeof candidate.code === 'string';
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
    async deleteItemAsync(key: string): Promise<void> {
      data.delete(key);
    },
  };
}

function getDefaultSecureStore(): SecureStoreApi {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const asyncStorage = require('@react-native-async-storage/async-storage') as {
      default: {
        getItem(key: string): Promise<string | null>;
        setItem(key: string, value: string): Promise<void>;
        removeItem(key: string): Promise<void>;
      };
    };

    return {
      getItemAsync: key => asyncStorage.default.getItem(key),
      setItemAsync: (key, value) => asyncStorage.default.setItem(key, value),
      deleteItemAsync: key => asyncStorage.default.removeItem(key),
    };
  } catch {
    return createInMemorySecureStore();
  }
}

function isStoredSession(value: unknown): value is StoredMatrixAuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.accessToken === 'string' &&
    (typeof candidate.refreshToken === 'undefined' ||
      typeof candidate.refreshToken === 'string') &&
    typeof candidate.expiresAtMs === 'number'
  );
}

export class MatrixAuthSessionStore {
  constructor(
    private readonly secureStore: SecureStoreApi = getDefaultSecureStore(),
    private readonly now: () => number = Date.now,
  ) {}

  async saveSession(session: MatrixAuthSession, ttlMs: number): Promise<void> {
    try {
      const payload: StoredMatrixAuthSession = {
        ...session,
        expiresAtMs: this.now() + ttlMs,
      };

      await this.secureStore.setItemAsync(
        MATRIX_AUTH_SESSION_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      throw createSautiError(
        'MATRIX_SESSION_STORE_FAILED',
        'Failed to persist Matrix auth session in SecureStore.',
        error,
      );
    }
  }

  async clearSession(): Promise<void> {
    try {
      await this.secureStore.deleteItemAsync(MATRIX_AUTH_SESSION_KEY);
    } catch (error) {
      throw createSautiError(
        'MATRIX_SESSION_STORE_FAILED',
        'Failed to clear Matrix auth session from SecureStore.',
        error,
      );
    }
  }

  async loadSession(): Promise<MatrixAuthSession | null> {
    const raw = await this.readRawSession();
    if (!raw) {
      return null;
    }

    if (raw.expiresAtMs <= this.now()) {
      throw createSautiError(
        'MATRIX_SESSION_EXPIRED',
        'Stored Matrix auth session has expired.',
      );
    }

    return {
      userId: raw.userId,
      accessToken: raw.accessToken,
      deviceId: raw.deviceId,
      refreshToken: raw.refreshToken,
    };
  }

  async getRequiredValidSession(): Promise<MatrixAuthSession> {
    const session = await this.loadSession();

    if (!session) {
      throw createSautiError(
        'MATRIX_SESSION_MISSING',
        'No Matrix auth session found in SecureStore.',
      );
    }

    return session;
  }

  private async readRawSession(): Promise<StoredMatrixAuthSession | null> {
    try {
      const raw = await this.secureStore.getItemAsync(MATRIX_AUTH_SESSION_KEY);

      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!isStoredSession(parsed)) {
        throw createSautiError(
          'MATRIX_SESSION_INVALID',
          'Stored Matrix auth session is malformed.',
        );
      }

      return parsed;
    } catch (error) {
      if (isSautiError(error)) {
        throw error;
      }

      throw createSautiError(
        'MATRIX_SESSION_INVALID',
        'Stored Matrix auth session could not be parsed.',
        error,
      );
    }
  }
}
