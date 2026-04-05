import {readSupabaseEnv} from '../../../core/config/env';
import {MatrixAuthSession} from '../../../core/matrix';
import {SautiError} from '../../../core/matrix/MatrixClient';

export interface MatrixRegistrationRequest {
  phoneNumber: string;
  otpCode: string;
  password: string;
  displayName?: string;
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
        throw new Error(`Registration failed with status ${response.status}`);
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
        'Failed to register Matrix account via Supabase edge function.',
        error,
      );
    }
  }
}
