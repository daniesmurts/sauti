import {readSupabaseEnv} from '../../../core/config/env';
import {SautiError} from '../../../core/matrix/MatrixClient';

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

function getDefaultSecureStore(): SecureStoreApi {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-secure-store') as SecureStoreApi;
  } catch {
    throw new SautiError(
      'SUBSCRIPTION_CACHE_FAILED',
      'SecureStore is unavailable for subscription cache.',
    );
  }
}

export type SubscriptionPlan = 'free' | 'family';
export type SubscriptionState = 'active' | 'expired' | 'cancelled';

export interface SubscriptionStatus {
  matrixUserId: string;
  plan: SubscriptionPlan;
  status: SubscriptionState;
  currentPeriodEnd?: string;
}

interface CachedSubscriptionStatus {
  expiresAtMs: number;
  value: SubscriptionStatus;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.matrixUserId === 'string' &&
    (value.plan === 'free' || value.plan === 'family') &&
    (value.status === 'active' ||
      value.status === 'expired' ||
      value.status === 'cancelled') &&
    (typeof value.currentPeriodEnd === 'undefined' ||
      typeof value.currentPeriodEnd === 'string')
  );
}

function isCachedStatus(value: unknown): value is CachedSubscriptionStatus {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.expiresAtMs === 'number' && isSubscriptionStatus(value.value);
}

export interface SubscriptionStatusServiceOptions {
  fetchFn?: typeof fetch;
  secureStore?: SecureStoreApi;
  now?: () => number;
  ttlMs?: number;
}

export class SubscriptionStatusService {
  private readonly fetchFn: typeof fetch;
  private readonly secureStore: SecureStoreApi;
  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(options: SubscriptionStatusServiceOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.secureStore = options.secureStore ?? getDefaultSecureStore();
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  async getStatus(matrixUserId: string): Promise<SubscriptionStatus> {
    const cached = await this.loadCachedStatus(matrixUserId);
    if (cached && cached.expiresAtMs > this.now()) {
      return cached.value;
    }

    const fresh = await this.fetchStatus(matrixUserId);
    await this.saveCachedStatus(fresh);
    return fresh;
  }

  async clearCachedStatus(matrixUserId: string): Promise<void> {
    try {
      await this.secureStore.deleteItemAsync(this.cacheKey(matrixUserId));
    } catch (error) {
      throw new SautiError(
        'SUBSCRIPTION_CACHE_FAILED',
        'Failed to clear cached subscription status.',
        error,
      );
    }
  }

  private async fetchStatus(matrixUserId: string): Promise<SubscriptionStatus> {
    const env = readSupabaseEnv();

    try {
      const response = await this.fetchFn(
        `${env.supabaseUrl}/functions/v1/subscription-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.supabaseAnonKey,
            Authorization: `Bearer ${env.supabaseAnonKey}`,
          },
          body: JSON.stringify({matrixUserId}),
        },
      );

      if (!response.ok) {
        throw new Error(`Subscription status failed with status ${response.status}`);
      }

      const payloadUnknown: unknown = await response.json();
      if (!isSubscriptionStatus(payloadUnknown)) {
        throw new Error('Subscription payload is invalid.');
      }

      return payloadUnknown;
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'SUBSCRIPTION_FETCH_FAILED',
        'Failed to fetch subscription status from Supabase.',
        error,
      );
    }
  }

  private async loadCachedStatus(
    matrixUserId: string,
  ): Promise<CachedSubscriptionStatus | null> {
    try {
      const raw = await this.secureStore.getItemAsync(this.cacheKey(matrixUserId));
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (!isCachedStatus(parsed)) {
        return null;
      }

      return parsed;
    } catch (error) {
      throw new SautiError(
        'SUBSCRIPTION_CACHE_FAILED',
        'Failed to read cached subscription status.',
        error,
      );
    }
  }

  private async saveCachedStatus(status: SubscriptionStatus): Promise<void> {
    const payload: CachedSubscriptionStatus = {
      expiresAtMs: this.now() + this.ttlMs,
      value: status,
    };

    try {
      await this.secureStore.setItemAsync(
        this.cacheKey(status.matrixUserId),
        JSON.stringify(payload),
      );
    } catch (error) {
      throw new SautiError(
        'SUBSCRIPTION_CACHE_FAILED',
        'Failed to cache subscription status.',
        error,
      );
    }
  }

  private cacheKey(matrixUserId: string): string {
    return `subscription.status.v1.${matrixUserId}`;
  }
}
