import {createStore, StoreApi} from 'zustand/vanilla';

import {EnsureCoreRuntimeOptions} from '../../../app';
import {SautiError} from '../../../core/matrix';

import {AuthApplicationService} from '../AuthApplicationService';
import {MatrixRegistrationRequest} from '../api';

export type AuthStatus =
  | 'idle'
  | 'registering'
  | 'resuming'
  | 'ready'
  | 'signed_out'
  | 'error';

export interface AuthStoreSnapshot {
  status: AuthStatus;
  reason?: 'session_missing' | 'session_expired' | 'session_invalid';
  errorMessage?: string;
  userId?: string;
  subscriptionPlan?: 'free' | 'family';
  subscriptionWarning?: string;
}

export interface AuthStoreState extends AuthStoreSnapshot {
  registerAndBootstrap(
    request: MatrixRegistrationRequest,
    options?: EnsureCoreRuntimeOptions,
  ): Promise<void>;
  resumeFromStoredSession(options?: EnsureCoreRuntimeOptions): Promise<void>;
  reset(): void;
}

export interface AuthStoreOptions {
  authService?: AuthApplicationService;
  currentUserIdProvider?: () => string;
}

const initialSnapshot: AuthStoreSnapshot = {
  status: 'idle',
  reason: undefined,
  errorMessage: undefined,
  userId: undefined,
  subscriptionPlan: undefined,
  subscriptionWarning: undefined,
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown auth error';
}

export function createAuthStore(
  options: AuthStoreOptions = {},
): StoreApi<AuthStoreState> {
  const authService = options.authService ?? new AuthApplicationService();
  const currentUserIdProvider = options.currentUserIdProvider ?? (() => '');

  return createStore<AuthStoreState>((set, _get) => ({
    ...initialSnapshot,
    async registerAndBootstrap(request, runtimeOptions) {
      set({
        status: 'registering',
        reason: undefined,
        errorMessage: undefined,
        subscriptionWarning: undefined,
      });

      try {
        const result = await authService.registerAndBootstrap(request, {
          runtime: runtimeOptions,
        });

        set({
          status: 'ready',
          reason: undefined,
          errorMessage: undefined,
          userId: result.registration.userId,
          subscriptionPlan: result.subscriptionStatus?.plan,
          subscriptionWarning: result.subscriptionError?.message,
        });
      } catch (error) {
        const message =
          error instanceof SautiError ? error.message : toErrorMessage(error);

        set({
          status: 'error',
          errorMessage: message,
        });
      }
    },
    async resumeFromStoredSession(runtimeOptions) {
      set({
        status: 'resuming',
        reason: undefined,
        errorMessage: undefined,
        subscriptionWarning: undefined,
      });

      try {
        const result = await authService.resumeFromStoredSession({
          runtime: runtimeOptions,
        });

        if (result.startup.status !== 'ready') {
          set({
            status: 'signed_out',
            reason: result.startup.reason,
            userId: undefined,
            subscriptionPlan: undefined,
            subscriptionWarning: undefined,
          });
          return;
        }

        const userId =
          result.subscriptionStatus?.matrixUserId || currentUserIdProvider() || undefined;

        set({
          status: 'ready',
          reason: undefined,
          errorMessage: undefined,
          userId,
          subscriptionPlan: result.subscriptionStatus?.plan,
          subscriptionWarning: result.subscriptionError?.message,
        });
      } catch (error) {
        const message =
          error instanceof SautiError ? error.message : toErrorMessage(error);

        set({
          status: 'error',
          errorMessage: message,
        });
      }
    },
    reset() {
      set({...initialSnapshot});
    },
  }));
}
