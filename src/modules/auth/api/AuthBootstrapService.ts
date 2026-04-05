import {
  EnsureCoreRuntimeOptions,
  MatrixStartupResult,
  startCoreRuntime,
} from '../../../app';
import {MatrixAuthSessionStore} from '../../../core/storage';
import {SautiError} from '../../../core/matrix/MatrixClient';
import {
  SubscriptionStatus,
  SubscriptionStatusService,
} from '../../subscription/api';

import {
  MatrixRegistrationRequest,
  MatrixRegistrationResult,
  MatrixRegistrationService,
} from './MatrixRegistrationService';

interface AuthBootstrapDeps {
  register: (request: MatrixRegistrationRequest) => Promise<MatrixRegistrationResult>;
  saveSession: (
    session: {
      userId: string;
      accessToken: string;
      deviceId?: string;
      refreshToken?: string;
    },
    ttlMs: number,
  ) => Promise<void>;
  startRuntime: (
    options?: EnsureCoreRuntimeOptions,
  ) => Promise<MatrixStartupResult>;
  getSubscriptionStatus: (matrixUserId: string) => Promise<SubscriptionStatus>;
  getStoredSession: () => Promise<{
    userId: string;
  } | null>;
}

export interface AuthBootstrapResult {
  registration: MatrixRegistrationResult;
  startup: MatrixStartupResult;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionError?: SautiError;
}

export interface SessionBootstrapResult {
  startup: MatrixStartupResult;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionError?: SautiError;
}

export interface AuthBootstrapOptions {
  runtime?: EnsureCoreRuntimeOptions;
}

export class AuthBootstrapService {
  private readonly deps: AuthBootstrapDeps;

  constructor(deps: Partial<AuthBootstrapDeps> = {}) {
    const registrationService = deps.register
      ? null
      : new MatrixRegistrationService();
    const sessionStore = deps.saveSession ? null : new MatrixAuthSessionStore();
    const subscriptionService = deps.getSubscriptionStatus
      ? null
      : new SubscriptionStatusService();

    this.deps = {
      register:
        deps.register ??
        (request => {
          if (!registrationService) {
            throw new Error('Registration service unavailable.');
          }

          return registrationService.registerViaSupabase(request);
        }),
      saveSession:
        deps.saveSession ??
        ((session, ttlMs) => {
          if (!sessionStore) {
            throw new Error('Session store unavailable.');
          }

          return sessionStore.saveSession(session, ttlMs);
        }),
      startRuntime: deps.startRuntime ?? (options => startCoreRuntime(options)),
      getSubscriptionStatus:
        deps.getSubscriptionStatus ??
        (matrixUserId => {
          if (!subscriptionService) {
            throw new Error('Subscription service unavailable.');
          }

          return subscriptionService.getStatus(matrixUserId);
        }),
      getStoredSession:
        deps.getStoredSession ??
        (() => {
          if (!sessionStore) {
            throw new Error('Session store unavailable.');
          }

          return sessionStore.loadSession();
        }),
    };
  }

  async registerAndBootstrap(
    request: MatrixRegistrationRequest,
    options: AuthBootstrapOptions = {},
  ): Promise<AuthBootstrapResult> {
    try {
      const registration = await this.deps.register(request);

      await this.deps.saveSession(
        {
          userId: registration.userId,
          accessToken: registration.accessToken,
          deviceId: registration.deviceId,
          refreshToken: registration.refreshToken,
        },
        registration.expiresInMs,
      );

      const startup = await this.deps.startRuntime(options.runtime);

      if (startup.status !== 'ready') {
        throw new SautiError(
          'AUTH_BOOTSTRAP_FAILED',
          `Runtime startup did not reach ready state: ${startup.reason}`,
        );
      }

      try {
        const subscriptionStatus = await this.deps.getSubscriptionStatus(
          registration.userId,
        );

        return {
          registration,
          startup,
          subscriptionStatus,
        };
      } catch (error) {
        const subscriptionError =
          error instanceof SautiError
            ? error
            : new SautiError(
                'SUBSCRIPTION_FETCH_FAILED',
                'Subscription status fetch failed after successful bootstrap.',
                error,
              );

        return {
          registration,
          startup,
          subscriptionStatus: null,
          subscriptionError,
        };
      }
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_BOOTSTRAP_FAILED',
        'Auth bootstrap flow failed.',
        error,
      );
    }
  }

  async bootstrapFromStoredSession(
    options: AuthBootstrapOptions = {},
  ): Promise<SessionBootstrapResult> {
    try {
      const startup = await this.deps.startRuntime(options.runtime);

      if (startup.status !== 'ready') {
        return {
          startup,
          subscriptionStatus: null,
        };
      }

      const session = await this.deps.getStoredSession();
      if (!session?.userId) {
        throw new SautiError(
          'AUTH_BOOTSTRAP_FAILED',
          'Runtime started but no stored session userId is available.',
        );
      }

      try {
        const subscriptionStatus = await this.deps.getSubscriptionStatus(
          session.userId,
        );

        return {
          startup,
          subscriptionStatus,
        };
      } catch (error) {
        const subscriptionError =
          error instanceof SautiError
            ? error
            : new SautiError(
                'SUBSCRIPTION_FETCH_FAILED',
                'Subscription status fetch failed after session bootstrap.',
                error,
              );

        return {
          startup,
          subscriptionStatus: null,
          subscriptionError,
        };
      }
    } catch (error) {
      if (error instanceof SautiError) {
        throw error;
      }

      throw new SautiError(
        'AUTH_BOOTSTRAP_FAILED',
        'Stored-session bootstrap flow failed.',
        error,
      );
    }
  }
}
