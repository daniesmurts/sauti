import {create} from 'zustand';

import {AfriLinkError} from '../../../core/errors';
import {
  type AuthSession,
  authService,
} from '../../../core/auth/AuthService';

export interface AuthState {
  status: 'idle' | 'loading' | 'otp_sent' | 'authenticated' | 'error';
  pendingEmail: string | null;
  hasTotpEnabled: boolean;
  totpFactorId: string | null;
  error: AfriLinkError | null;
  session: AuthSession | null;

  sendOtp: (email: string, isNewUser: boolean) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  verifyTotp: (code: string) => Promise<void>;
  useRecoveryCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function toAuthError(error: unknown): AfriLinkError {
  if (error instanceof AfriLinkError) {
    return error;
  }

  return new AfriLinkError('NETWORK_ERROR', 'Authentication failed.', error);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  pendingEmail: null,
  hasTotpEnabled: false,
  totpFactorId: null,
  error: null,
  session: null,

  async sendOtp(email, isNewUser) {
    set({status: 'loading', error: null});

    try {
      if (isNewUser) {
        await authService.signUpWithEmail(email);
      } else {
        await authService.signInWithEmail(email);
      }

      set({
        status: 'otp_sent',
        pendingEmail: email.trim().toLowerCase(),
        error: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: toAuthError(error),
      });
    }
  },

  async verifyOtp(code) {
    const pendingEmail = get().pendingEmail;
    if (!pendingEmail) {
      set({
        status: 'error',
        error: new AfriLinkError('SESSION_EXPIRED', 'Pending email was not found.'),
      });
      return;
    }

    set({status: 'loading', error: null});

    try {
      const session = await authService.verifyEmailOtp(pendingEmail, code);
      const totpStatus = await authService.getTotpStatus();

      set({
        status: totpStatus.enabled ? 'otp_sent' : 'authenticated',
        session,
        hasTotpEnabled: totpStatus.enabled,
        totpFactorId: totpStatus.factorId,
        error: null,
      });
    } catch (error) {
      set({
        status: 'error',
        error: toAuthError(error),
      });
    }
  },

  async verifyTotp(code) {
    set({status: 'loading', error: null});

    try {
      await authService.verifyTotpLogin(code);
      set({status: 'authenticated', error: null});
    } catch (error) {
      set({status: 'error', error: toAuthError(error)});
    }
  },

  async useRecoveryCode(code) {
    set({status: 'loading', error: null});

    try {
      await authService.useRecoveryCode(code);
      set({status: 'authenticated', error: null});
    } catch (error) {
      set({status: 'error', error: toAuthError(error)});
    }
  },

  async signOut() {
    set({status: 'loading', error: null});

    try {
      await authService.signOut();
      set({
        status: 'idle',
        pendingEmail: null,
        hasTotpEnabled: false,
        totpFactorId: null,
        session: null,
        error: null,
      });
    } catch (error) {
      set({status: 'error', error: toAuthError(error)});
    }
  },

  clearError() {
    set({
      error: null,
      status: get().session ? 'authenticated' : 'idle',
    });
  },
}));import {createStore, StoreApi} from 'zustand/vanilla';

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
