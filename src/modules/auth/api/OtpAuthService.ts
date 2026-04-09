import {readSupabaseEnv} from '../../../core/config/env';
import {SautiError} from '../../../core/matrix/MatrixClient';

export interface RequestOtpInput {
  phoneNumber: string;
}

export interface RequestOtpResult {
  requestId?: string;
  expiresInSeconds?: number;
}

export interface VerifyOtpInput {
  phoneNumber: string;
  otpCode: string;
  requestId?: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  firebaseIdToken?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isRequestOtpPayload(value: unknown): value is RequestOtpResult {
  if (!isObject(value)) {
    return false;
  }

  return (
    (typeof value.requestId === 'undefined' || typeof value.requestId === 'string') &&
    (typeof value.expiresInSeconds === 'undefined' ||
      typeof value.expiresInSeconds === 'number')
  );
}

function isVerifyOtpPayload(value: unknown): value is VerifyOtpResult {
  return isObject(value) && value.verified === true;
}

async function readOptionalJson(response: Response): Promise<unknown | null> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  return response.json();
}

export class OtpAuthService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async requestOtp(request: RequestOtpInput): Promise<RequestOtpResult> {
    const env = readSupabaseEnv();

    try {
      const response = await this.fetchFn(`${env.supabaseUrl}/functions/v1/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey,
          Authorization: `Bearer ${env.supabaseAnonKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`OTP request failed with status ${response.status}`);
      }

      const payload = await readOptionalJson(response);
      if (payload === null) {
        return {};
      }

      if (!isRequestOtpPayload(payload)) {
        throw new Error('OTP request payload is invalid.');
      }

      return payload;
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_OTP_REQUEST_FAILED',
        'Failed to request OTP verification code.',
        error,
      );
    }
  }

  async verifyOtp(request: VerifyOtpInput): Promise<VerifyOtpResult> {
    const env = readSupabaseEnv();

    try {
      const response = await this.fetchFn(`${env.supabaseUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey,
          Authorization: `Bearer ${env.supabaseAnonKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`OTP verification failed with status ${response.status}`);
      }

      const payload = await readOptionalJson(response);
      if (payload === null) {
        return {verified: true};
      }

      if (!isVerifyOtpPayload(payload)) {
        throw new Error('OTP verification payload is invalid.');
      }

      return payload;
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_OTP_VERIFY_FAILED',
        'Failed to verify OTP code.',
        error,
      );
    }
  }
}