import {createClient, type Session, type SupabaseClient} from '@supabase/supabase-js';

import {readSupabaseEnv} from '../config/env';
import {AfriLinkError} from '../errors';
import {logger} from '../../utils/logger';

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

interface TotpEnrollmentResult {
  id: string;
  qrCode: string;
  secret: string;
}

interface TotpStatus {
  enabled: boolean;
  factorId: string | null;
}

interface AuthServiceStorage {
  secureStore: SecureStoreApi;
}

type JsonObject = Record<string, unknown>;

const AUTH_SESSION_KEY = 'auth_session';
const MATRIX_CREDENTIALS_KEY = 'matrix_credentials';
const RECOVERY_CODES_KEY = 'recovery_codes';
const TOTP_FACTOR_ID_KEY = 'totp_factor_id';
const TOTP_ACTIVE_KEY = 'totp_active';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: {
    id: string;
    email?: string;
  };
}

export interface RecoveryCodeRecord {
  value: string;
  used: boolean;
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toAuthSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

function createInMemorySecureStore(): SecureStoreApi {
  const values = new Map<string, string>();

  return {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      values.delete(key);
    },
  };
}

function getDefaultSecureStore(): SecureStoreApi {
  try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const asyncStorage = require('@react-native-async-storage/async-storage') as {
        getItem(key: string): Promise<string | null>;
        setItem(key: string, value: string): Promise<void>;
        removeItem(key: string): Promise<void>;
      };

      if (asyncStorage && asyncStorage.getItem) {
        return {
          async getItemAsync(key) {
            return asyncStorage.getItem(key);
          },
          async setItemAsync(key, value) {
            await asyncStorage.setItem(key, value);
          },
          async deleteItemAsync(key) {
            await asyncStorage.removeItem(key);
          },
        };
      }
  } catch {
    // fall through
  }

  return createInMemorySecureStore();
}

function isLikelyNetworkError(value: unknown): boolean {
  if (!(value instanceof Error)) {
    return false;
  }

  const message = value.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  );
}

function mapSupabaseAuthError(error: unknown): AfriLinkError {
  if (error instanceof AfriLinkError) {
    return error;
  }

  if (isLikelyNetworkError(error)) {
    return new AfriLinkError('NETWORK_ERROR', 'Network connection unavailable.', error);
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();

    if (normalized.includes('invalid email') || normalized.includes('email address')) {
      return new AfriLinkError('INVALID_EMAIL', 'Please enter a valid email address.', error);
    }

    if (normalized.includes('expired')) {
      return new AfriLinkError('OTP_EXPIRED', 'The OTP code has expired.', error);
    }

    if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
      return new AfriLinkError(
        'RATE_LIMITED',
        'Too many OTP requests. Please wait and try again.',
        error,
      );
    }

    if (normalized.includes('invalid token') || normalized.includes('invalid otp')) {
      return new AfriLinkError('INVALID_OTP', 'The OTP code is invalid.', error);
    }

    if (normalized.includes('user not found')) {
      return new AfriLinkError('USER_NOT_FOUND', 'No account found for this email.', error);
    }

    if (normalized.includes('mfa') || normalized.includes('totp')) {
      return new AfriLinkError('TOTP_INVALID', 'Invalid TOTP code.', error);
    }
  }

  return new AfriLinkError('NETWORK_ERROR', 'Authentication request failed.', error);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateRecoveryCode(): string {
  let code = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }

  return code;
}

function parseJsonObject(raw: string | null): JsonObject | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as JsonObject;
  } catch {
    return null;
  }
}

function parseRecoveryCodes(raw: string | null): RecoveryCodeRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      value =>
        !!value &&
        typeof value === 'object' &&
        typeof (value as RecoveryCodeRecord).value === 'string' &&
        typeof (value as RecoveryCodeRecord).used === 'boolean',
    ) as RecoveryCodeRecord[];
  } catch {
    return [];
  }
}

export class AuthService {
  private readonly supabaseClient: SupabaseClient;

  private readonly secureStore: SecureStoreApi;

  private readonly supabaseEmailRedirectUrl: string;

  constructor(storage: Partial<AuthServiceStorage> = {}) {
    const env = readSupabaseEnv();
    this.supabaseEmailRedirectUrl =
      env.supabaseEmailRedirectUrl ?? 'https://matrix.sauti.ru';
    this.supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    this.secureStore = storage.secureStore ?? getDefaultSecureStore();
  }

  async signUpWithEmail(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new AfriLinkError('INVALID_EMAIL', 'Please enter a valid email address.');
    }

    try {
      const {error} = await this.supabaseClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: this.supabaseEmailRedirectUrl,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async verifyEmailOtp(email: string, token: string): Promise<AuthSession> {
    try {
      const {data, error} = await this.supabaseClient.auth.verifyOtp({
        email: normalizeEmail(email),
        token: token.trim(),
        type: 'email',
      });
      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new AfriLinkError('SESSION_EXPIRED', 'No active session was returned.');
      }

      const session = toAuthSession(data.session);
      await this.persistSession(session);

      return session;
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async signInWithEmail(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new AfriLinkError('INVALID_EMAIL', 'Please enter a valid email address.');
    }

    try {
      const {error} = await this.supabaseClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: this.supabaseEmailRedirectUrl,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      const mapped = mapSupabaseAuthError(error);
      if (mapped.code === 'NETWORK_ERROR' && error instanceof Error) {
        const normalized = error.message.toLowerCase();
        if (normalized.includes('not found') || normalized.includes('user')) {
          throw new AfriLinkError('USER_NOT_FOUND', 'No account found for this email.', error);
        }
      }

      throw mapped;
    }
  }

  async enrollTotp(): Promise<{
    qrCode: string;
    secret: string;
    recoveryCode: string[];
    factorId: string;
  }> {
    try {
      const {data, error} = await this.supabaseClient.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) {
        throw error;
      }

      const enrollment = this.extractTotpEnrollment(data);
      const recoveryCodes = Array.from({length: RECOVERY_CODE_COUNT}, () =>
        generateRecoveryCode(),
      );
      const records: RecoveryCodeRecord[] = recoveryCodes.map(value => ({
        value,
        used: false,
      }));

      await this.secureStore.setItemAsync(RECOVERY_CODES_KEY, JSON.stringify(records));
      await this.secureStore.setItemAsync(TOTP_FACTOR_ID_KEY, enrollment.id);

      return {
        qrCode: enrollment.qrCode,
        secret: enrollment.secret,
        recoveryCode: recoveryCodes,
        factorId: enrollment.id,
      };
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async verifyTotpEnrollment(code: string, factorId: string): Promise<void> {
    await this.verifyTotpFactor(code, factorId);
    await this.secureStore.setItemAsync(TOTP_ACTIVE_KEY, 'true');
    await this.secureStore.setItemAsync(TOTP_FACTOR_ID_KEY, factorId);
  }

  async verifyTotpLogin(code: string): Promise<void> {
    const factorId = await this.secureStore.getItemAsync(TOTP_FACTOR_ID_KEY);
    if (!factorId) {
      throw new AfriLinkError('TOTP_INVALID', 'TOTP is not configured.');
    }

    await this.verifyTotpFactor(code, factorId);
  }

  async useRecoveryCode(code: string): Promise<void> {
    const recoveryRecords = parseRecoveryCodes(
      await this.secureStore.getItemAsync(RECOVERY_CODES_KEY),
    );
    const normalized = code.trim().toUpperCase();

    const index = recoveryRecords.findIndex(
      entry => entry.value.toUpperCase() === normalized,
    );
    if (index < 0) {
      throw new AfriLinkError(
        'RECOVERY_CODE_INVALID',
        'Recovery code is invalid.',
      );
    }

    if (recoveryRecords[index].used) {
      throw new AfriLinkError('RECOVERY_CODE_USED', 'Recovery code was already used.');
    }

    recoveryRecords[index] = {
      ...recoveryRecords[index],
      used: true,
    };

    await this.secureStore.setItemAsync(RECOVERY_CODES_KEY, JSON.stringify(recoveryRecords));

    const unusedCount = recoveryRecords.filter(entry => !entry.used).length;
    if (unusedCount === 0) {
      logger.warn('All recovery codes are used; user should regenerate codes.');
    }
  }

  async getSession(): Promise<AuthSession | null> {
    const raw = await this.secureStore.getItemAsync(AUTH_SESSION_KEY);
    const parsed = parseJsonObject(raw);

    if (parsed && this.isAuthSessionShape(parsed)) {
      return parsed as unknown as AuthSession;
    }

    try {
      const {data, error} = await this.supabaseClient.auth.getSession();
      if (error) {
        throw error;
      }

      if (!data.session) {
        return null;
      }

      const session = toAuthSession(data.session);
      await this.persistSession(session);

      return session;
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      const {error} = await this.supabaseClient.auth.signOut();
      if (error) {
        throw error;
      }

      await this.secureStore.deleteItemAsync(AUTH_SESSION_KEY);
      await this.secureStore.deleteItemAsync(MATRIX_CREDENTIALS_KEY);
      await this.secureStore.deleteItemAsync(TOTP_FACTOR_ID_KEY);
      await this.secureStore.deleteItemAsync(TOTP_ACTIVE_KEY);
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async refreshSession(): Promise<void> {
    try {
      const {data, error} = await this.supabaseClient.auth.refreshSession();
      if (error) {
        throw error;
      }

      if (data.session) {
        await this.persistSession(toAuthSession(data.session));
      }
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  async getTotpStatus(): Promise<TotpStatus> {
    const active = (await this.secureStore.getItemAsync(TOTP_ACTIVE_KEY)) === 'true';
    const factorId = await this.secureStore.getItemAsync(TOTP_FACTOR_ID_KEY);

    if (active && factorId) {
      return {
        enabled: true,
        factorId,
      };
    }

    return {
      enabled: false,
      factorId: factorId ?? null,
    };
  }

  async getRecoveryCodes(): Promise<RecoveryCodeRecord[]> {
    return parseRecoveryCodes(await this.secureStore.getItemAsync(RECOVERY_CODES_KEY));
  }

  private async verifyTotpFactor(code: string, factorId: string): Promise<void> {
    const normalized = code.trim();
    if (!/^\d{6}$/.test(normalized)) {
      throw new AfriLinkError('TOTP_INVALID', 'Enter a valid 6-digit TOTP code.');
    }

    try {
      const {data: challengeData, error: challengeError} = await this.supabaseClient.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challengeData?.id) {
        throw challengeError ?? new Error('Unable to create MFA challenge.');
      }

      const {error} = await this.supabaseClient.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: normalized,
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      throw mapSupabaseAuthError(error);
    }
  }

  private extractTotpEnrollment(input: unknown): TotpEnrollmentResult {
    if (!input || typeof input !== 'object') {
      throw new AfriLinkError('TOTP_INVALID', 'Unable to initialize TOTP enrollment.');
    }

    const value = input as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id : undefined;
    const totp = value.totp as Record<string, unknown> | undefined;
    const qrCode =
      totp && typeof totp.qr_code === 'string'
        ? totp.qr_code
        : typeof value.qr_code === 'string'
          ? value.qr_code
          : undefined;
    const secret =
      totp && typeof totp.secret === 'string'
        ? totp.secret
        : typeof value.secret === 'string'
          ? value.secret
          : undefined;

    if (!id || !qrCode || !secret) {
      throw new AfriLinkError('TOTP_INVALID', 'Unable to initialize TOTP enrollment.');
    }

    return {
      id,
      qrCode,
      secret,
    };
  }

  private async persistSession(session: AuthSession): Promise<void> {
    await this.secureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
  }

  private isAuthSessionShape(value: JsonObject): boolean {
    const user = value.user;
    if (!user || typeof user !== 'object') {
      return false;
    }

    return (
      typeof value.accessToken === 'string' &&
      ((typeof value.refreshToken === 'string' ||
        typeof value.refreshToken === 'undefined') as boolean) &&
      ((typeof value.expiresAt === 'number' ||
        typeof value.expiresAt === 'undefined') as boolean) &&
      typeof (user as {id?: unknown}).id === 'string'
    );
  }
}

let authServiceSingleton: AuthService | null = null;

function getAuthServiceSingleton(): AuthService {
  if (!authServiceSingleton) {
    authServiceSingleton = new AuthService();
  }

  return authServiceSingleton;
}

export const authService = {
  signUpWithEmail(email: string): Promise<void> {
    return getAuthServiceSingleton().signUpWithEmail(email);
  },
  verifyEmailOtp(email: string, token: string): Promise<AuthSession> {
    return getAuthServiceSingleton().verifyEmailOtp(email, token);
  },
  signInWithEmail(email: string): Promise<void> {
    return getAuthServiceSingleton().signInWithEmail(email);
  },
  enrollTotp(): Promise<{
    qrCode: string;
    secret: string;
    recoveryCode: string[];
    factorId: string;
  }> {
    return getAuthServiceSingleton().enrollTotp();
  },
  verifyTotpEnrollment(code: string, factorId: string): Promise<void> {
    return getAuthServiceSingleton().verifyTotpEnrollment(code, factorId);
  },
  verifyTotpLogin(code: string): Promise<void> {
    return getAuthServiceSingleton().verifyTotpLogin(code);
  },
  useRecoveryCode(code: string): Promise<void> {
    return getAuthServiceSingleton().useRecoveryCode(code);
  },
  getSession(): Promise<AuthSession | null> {
    return getAuthServiceSingleton().getSession();
  },
  signOut(): Promise<void> {
    return getAuthServiceSingleton().signOut();
  },
  refreshSession(): Promise<void> {
    return getAuthServiceSingleton().refreshSession();
  },
  getTotpStatus(): Promise<TotpStatus> {
    return getAuthServiceSingleton().getTotpStatus();
  },
  getRecoveryCodes(): Promise<RecoveryCodeRecord[]> {
    return getAuthServiceSingleton().getRecoveryCodes();
  },
};