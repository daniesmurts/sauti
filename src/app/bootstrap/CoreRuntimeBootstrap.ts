import {
  CoreAppRuntime,
  CoreAppRuntimeOptions,
  getCoreAppRuntime,
  hasCoreAppRuntime,
  initializeCoreAppRuntime,
  MatrixStartupResult,
  resetCoreAppRuntimeForTests,
} from '../../core/runtime';
import {MatrixSyncTokenStore} from '../../core/matrix';
import {MatrixSyncSecureStoreTokenStore} from '../../core/storage';

export type AppBootstrapStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'signed_out'
  | 'error';

export interface AppBootstrapSnapshot {
  status: AppBootstrapStatus;
  reason?: 'session_missing' | 'session_expired' | 'session_invalid';
  errorMessage?: string;
}

export interface EnsureCoreRuntimeOptions
  extends Omit<CoreAppRuntimeOptions, 'tokenStore'> {
  tokenStore?: MatrixSyncTokenStore;
  replaceExisting?: boolean;
}

type AppBootstrapListener = (snapshot: AppBootstrapSnapshot) => void;

let snapshot: AppBootstrapSnapshot = {
  status: 'idle',
};

const listeners = new Set<AppBootstrapListener>();

function publish(next: AppBootstrapSnapshot): void {
  snapshot = next;
  listeners.forEach(listener => {
    listener(snapshot);
  });
}

export function getAppBootstrapSnapshot(): AppBootstrapSnapshot {
  return {...snapshot};
}

export function subscribeAppBootstrap(
  listener: AppBootstrapListener,
): () => void {
  listeners.add(listener);
  listener(getAppBootstrapSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function ensureCoreRuntimeInitialized(
  options: EnsureCoreRuntimeOptions = {},
): CoreAppRuntime {
  if (hasCoreAppRuntime() && !options.replaceExisting) {
    return getCoreAppRuntime();
  }

  const tokenStore = options.tokenStore ?? new MatrixSyncSecureStoreTokenStore();

  return initializeCoreAppRuntime(
    {
      tokenStore,
      sessionStore: options.sessionStore,
      database: options.database,
      dbName: options.dbName,
      currentUserIdFallback: options.currentUserIdFallback,
      messaging: options.messaging,
    },
    {
      replaceExisting: options.replaceExisting,
    },
  );
}

export async function startCoreRuntime(
  options: EnsureCoreRuntimeOptions = {},
): Promise<MatrixStartupResult> {
  publish({status: 'starting'});

  try {
    const runtime = ensureCoreRuntimeInitialized(options);
    const result = await runtime.start();

    if (result.status === 'ready') {
      publish({status: 'ready'});
    } else {
      publish({
        status: 'signed_out',
        reason: result.reason,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown startup error';
    publish({status: 'error', errorMessage});
    throw error;
  }
}

export async function recoverCoreRuntime(): Promise<void> {
  const runtime = getCoreAppRuntime();
  await runtime.recover();
}

export async function logoutCoreRuntime(): Promise<void> {
  const runtime = getCoreAppRuntime();
  await runtime.logout();
  publish({status: 'signed_out'});
}

export function stopCoreRuntime(): void {
  if (!hasCoreAppRuntime()) {
    publish({status: 'idle'});
    return;
  }

  getCoreAppRuntime().stop();
  publish({status: 'idle'});
}

export function resetAppBootstrapForTests(): void {
  listeners.clear();
  snapshot = {status: 'idle'};
  resetCoreAppRuntimeForTests();
}
