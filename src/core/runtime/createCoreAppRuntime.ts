import {createSautiDatabase, WatermelonDbWiper} from '../db';
import {
  createDefaultMatrixLifecycleService,
  MatrixLifecycleEvent,
  MatrixLifecycleSnapshot,
  MatrixAuthSessionProvider,
  MatrixLogoutReport,
  MatrixStartupResult,
  MatrixSyncTokenStore,
} from '../matrix';
import {
  CoreMessagingRuntime,
  CoreMessagingRuntimeOptions,
  createCoreMessagingRuntime,
} from '../messaging';
import {MatrixAuthSessionStore} from '../storage';

type WatermelonDatabase = ReturnType<typeof createSautiDatabase>;

export interface CoreAppRuntimeOptions {
  tokenStore: MatrixSyncTokenStore;
  sessionStore?: MatrixAuthSessionStore;
  database?: WatermelonDatabase;
  dbName?: string;
  currentUserIdFallback?: () => string;
  messaging?: Omit<CoreMessagingRuntimeOptions, 'database' | 'currentUserIdProvider'>;
}

export interface CoreAppRuntime {
  database: WatermelonDatabase;
  messaging: CoreMessagingRuntime;
  start(): Promise<MatrixStartupResult>;
  recover(): Promise<void>;
  logout(): Promise<MatrixLogoutReport>;
  stop(): void;
  getCurrentUserId(): string;
  getLifecycleSnapshot(): MatrixLifecycleSnapshot;
  subscribeLifecycle(listener: (event: MatrixLifecycleEvent) => void): () => void;
}

export function createCoreAppRuntime(options: CoreAppRuntimeOptions): CoreAppRuntime {
  const database = options.database ?? createSautiDatabase({dbName: options.dbName});
  const sessionStore = options.sessionStore ?? new MatrixAuthSessionStore();

  let currentUserId = '';

  const sessionProvider: MatrixAuthSessionProvider = {
    async getRequiredValidSession() {
      const session = await sessionStore.getRequiredValidSession();
      currentUserId = session.userId;
      return session;
    },
  };

  const currentUserIdProvider = (): string => {
    return currentUserId || options.currentUserIdFallback?.() || 'self';
  };

  const messaging = createCoreMessagingRuntime({
    ...options.messaging,
    database,
    currentUserIdProvider,
  });

  const lifecycle = createDefaultMatrixLifecycleService(
    new WatermelonDbWiper(database),
    sessionStore,
    messaging.getMatrixLifecycleOptions(),
  );

  return {
    database,
    messaging,
    async start() {
      const result = await lifecycle.start(options.tokenStore, sessionProvider);

      if (result.status === 'ready') {
        messaging.start();
      } else {
        messaging.stop();
        currentUserId = '';
      }

      return result;
    },
    async recover() {
      await lifecycle.recover();
    },
    async logout() {
      const report = await lifecycle.logout();
      messaging.stop();
      currentUserId = '';
      return report;
    },
    stop() {
      messaging.stop();
    },
    getCurrentUserId() {
      return currentUserIdProvider();
    },
    getLifecycleSnapshot() {
      return lifecycle.getSnapshot();
    },
    subscribeLifecycle(listener) {
      return lifecycle.subscribe(listener);
    },
  };
}
