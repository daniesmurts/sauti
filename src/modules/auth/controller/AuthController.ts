import {EnsureCoreRuntimeOptions} from '../../../app';

import {MatrixRegistrationRequest} from '../api';
import {
  AuthStoreOptions,
  AuthStoreSnapshot,
  AuthStoreState,
  createAuthStore,
} from '../store';

interface AuthStoreLike {
  getState(): AuthStoreState;
  subscribe(listener: (state: AuthStoreState, previous: AuthStoreState) => void): () => void;
}

export interface AuthController {
  getSnapshot(): AuthStoreSnapshot;
  subscribe(listener: (snapshot: AuthStoreSnapshot) => void): () => void;
  registerAndBootstrap(
    request: MatrixRegistrationRequest,
    options?: EnsureCoreRuntimeOptions,
  ): Promise<void>;
  resumeFromStoredSession(options?: EnsureCoreRuntimeOptions): Promise<void>;
  reset(): void;
}

export interface AuthControllerOptions extends AuthStoreOptions {
  store?: AuthStoreLike;
}

function toSnapshot(state: AuthStoreState): AuthStoreSnapshot {
  return {
    status: state.status,
    reason: state.reason,
    errorMessage: state.errorMessage,
    userId: state.userId,
    subscriptionPlan: state.subscriptionPlan,
    subscriptionWarning: state.subscriptionWarning,
  };
}

export function createAuthController(
  options: AuthControllerOptions = {},
): AuthController {
  const store =
    options.store ??
    createAuthStore({
      authService: options.authService,
      currentUserIdProvider: options.currentUserIdProvider,
    });

  return {
    getSnapshot() {
      return toSnapshot(store.getState());
    },
    subscribe(listener) {
      listener(toSnapshot(store.getState()));
      return store.subscribe(state => {
        listener(toSnapshot(state));
      });
    },
    async registerAndBootstrap(request, runtimeOptions) {
      await store.getState().registerAndBootstrap(request, runtimeOptions);
    },
    async resumeFromStoredSession(runtimeOptions) {
      await store.getState().resumeFromStoredSession(runtimeOptions);
    },
    reset() {
      store.getState().reset();
    },
  };
}
