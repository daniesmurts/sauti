import {AuthController, AuthStoreSnapshot, createAuthController} from '../../modules/auth';

import {
  AppBootstrapSnapshot,
  EnsureCoreRuntimeOptions,
  ensureCoreRuntimeInitialized,
  getAppBootstrapSnapshot,
  stopCoreRuntime,
  subscribeAppBootstrap,
} from './CoreRuntimeBootstrap';

export type AppStartupStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'signed_out'
  | 'error';

export interface AppStartupSnapshot {
  status: AppStartupStatus;
  reason?: 'session_missing' | 'session_expired' | 'session_invalid';
  errorMessage?: string;
  auth: AuthStoreSnapshot;
  bootstrap: AppBootstrapSnapshot;
}

interface BootstrapBridge {
  ensureInitialized(options?: EnsureCoreRuntimeOptions): void;
  getSnapshot(): AppBootstrapSnapshot;
  subscribe(listener: (snapshot: AppBootstrapSnapshot) => void): () => void;
  stop(): void;
}

export interface AppStartupOrchestrator {
  getSnapshot(): AppStartupSnapshot;
  subscribe(listener: (snapshot: AppStartupSnapshot) => void): () => void;
  initializeAndResume(options?: EnsureCoreRuntimeOptions): Promise<void>;
  stop(): void;
  reset(): void;
}

export interface AppStartupOrchestratorOptions {
  authController?: AuthController;
  bootstrap?: BootstrapBridge;
}

const defaultAuthSnapshot: AuthStoreSnapshot = {
  status: 'idle',
};

const defaultBootstrapBridge: BootstrapBridge = {
  ensureInitialized(options) {
    ensureCoreRuntimeInitialized(options);
  },
  getSnapshot() {
    return getAppBootstrapSnapshot();
  },
  subscribe(listener) {
    return subscribeAppBootstrap(listener);
  },
  stop() {
    stopCoreRuntime();
  },
};

function deriveSnapshot(
  auth: AuthStoreSnapshot,
  bootstrap: AppBootstrapSnapshot,
): AppStartupSnapshot {
  if (auth.status === 'ready') {
    return {status: 'ready', auth, bootstrap};
  }

  if (auth.status === 'error') {
    return {
      status: 'error',
      errorMessage: auth.errorMessage,
      auth,
      bootstrap,
    };
  }

  if (bootstrap.status === 'error') {
    return {
      status: 'error',
      errorMessage: bootstrap.errorMessage,
      auth,
      bootstrap,
    };
  }

  if (auth.status === 'signed_out' || bootstrap.status === 'signed_out') {
    return {
      status: 'signed_out',
      reason: auth.reason ?? bootstrap.reason,
      auth,
      bootstrap,
    };
  }

  if (
    auth.status === 'registering' ||
    auth.status === 'resuming' ||
    bootstrap.status === 'starting'
  ) {
    return {
      status: 'initializing',
      auth,
      bootstrap,
    };
  }

  return {status: 'idle', auth, bootstrap};
}

export function createAppStartupOrchestrator(
  options: AppStartupOrchestratorOptions = {},
): AppStartupOrchestrator {
  const authController = options.authController ?? createAuthController();
  const bootstrap = options.bootstrap ?? defaultBootstrapBridge;

  let authSnapshot = authController.getSnapshot();
  let bootstrapSnapshot = bootstrap.getSnapshot();
  let snapshot = deriveSnapshot(authSnapshot, bootstrapSnapshot);

  const listeners = new Set<(next: AppStartupSnapshot) => void>();

  const publish = () => {
    snapshot = deriveSnapshot(authSnapshot, bootstrapSnapshot);
    listeners.forEach(listener => {
      listener(snapshot);
    });
  };

  const unsubscribeBootstrap = bootstrap.subscribe(next => {
    bootstrapSnapshot = next;
    publish();
  });

  const unsubscribeAuth = authController.subscribe(next => {
    authSnapshot = next;
    publish();
  });

  return {
    getSnapshot() {
      return {...snapshot};
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(this.getSnapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    async initializeAndResume(runtimeOptions) {
      bootstrap.ensureInitialized(runtimeOptions);
      await authController.resumeFromStoredSession(runtimeOptions);
    },
    stop() {
      bootstrap.stop();
    },
    reset() {
      authController.reset();
      bootstrap.stop();
    },
  };
}
