import {readSupabaseEnv} from '../../../core/config/env';
import {MatrixAuthSession} from '../../../core/matrix';
import {SautiError} from '../../../core/matrix/MatrixClient';

export interface MatrixRegistrationRequest {
  phoneNumber: string;
  otpCode: string;
  password: string;
  displayName?: string;
  firebaseIdToken?: string;
}

export interface MatrixRegistrationResult extends MatrixAuthSession {
  expiresInMs: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isRegistrationPayload(value: unknown): value is {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs?: number;
} {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === 'string' &&
    typeof value.accessToken === 'string' &&
    (typeof value.deviceId === 'undefined' || typeof value.deviceId === 'string') &&
    (typeof value.refreshToken === 'undefined' ||
      typeof value.refreshToken === 'string') &&
    (typeof value.expiresInMs === 'undefined' ||
      typeof value.expiresInMs === 'number')
  );
}

function isErrorPayload(value: unknown): value is {error: string} {
  return isObject(value) && typeof value.error === 'string';
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export class MatrixRegistrationService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async registerViaSupabase(
    request: MatrixRegistrationRequest,
  ): Promise<MatrixRegistrationResult> {
    const env = readSupabaseEnv();

    try {
      const response = await this.fetchFn(
        `${env.supabaseUrl}/functions/v1/register-matrix-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.supabaseAnonKey,
            Authorization: `Bearer ${env.supabaseAnonKey}`,
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        const errorPayload = await readJsonSafe(response);
        if (isErrorPayload(errorPayload)) {
          throw new Error(errorPayload.error);
        }

        const errorText = await readTextSafe(response);
        throw new Error(
          errorText || `Registration failed with status ${response.status}`,
        );
      }

      const payloadUnknown: unknown = await response.json();
      if (!isRegistrationPayload(payloadUnknown)) {
        throw new Error('Registration payload is invalid.');
      }

      return {
        userId: payloadUnknown.userId,
        accessToken: payloadUnknown.accessToken,
        deviceId: payloadUnknown.deviceId,
        refreshToken: payloadUnknown.refreshToken,
        expiresInMs: payloadUnknown.expiresInMs ?? 24 * 60 * 60 * 1000,
      };
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_REGISTRATION_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to register Matrix account via Supabase edge function.',
        error,
      );
    }
  }
}
