import {MatrixAuthSessionStore} from '../storage/MatrixAuthSessionStore';
import {ProxyStatus} from '../proxy';

import {
  ConnectionState,
  matrixClient,
  MatrixClientEvent,
  SautiError,
} from './MatrixClient';
import {createDefaultMatrixLogoutOrchestrator, MatrixDbWiper, MatrixLogoutOrchestrator, MatrixLogoutReport} from './MatrixLogout';
import {MatrixRuntime} from './MatrixRuntime';
import {MatrixAuthSessionProvider} from './MatrixBoot';
import {startMatrixFromStoredSession, MatrixStartupResult} from './MatrixStartup';
import {MatrixSyncTokenStore} from './MatrixSync';
import {MatrixTokenRefreshService} from './MatrixTokenRefreshService';

export interface MatrixLifecycleDeps {
  startFromStoredSession: (
    tokenStore: MatrixSyncTokenStore,
    sessionProvider: MatrixAuthSessionProvider,
  ) => Promise<MatrixStartupResult>;
  logoutOrchestrator: MatrixLogoutOrchestrator;
  tokenRefresher?: {
    refreshNow(): Promise<void>;
  };
  matrixEventSource?: {
    subscribe(listener: (event: MatrixClientEvent) => void): () => void;
  };
  timelineReconciliation?: {
    start(): void;
    stop(): void;
  };
  roomDirectory?: {
    start(): void;
    stop(): void;
  };
}

export type MatrixLifecycleEvent =
  | {
      type: 'proxyStatusChanged';
      status: ProxyStatus;
    }
  | {
      type: 'connectionStateChanged';
      state: ConnectionState;
    };

export interface MatrixLifecycleSnapshot {
  startupStatus: 'idle' | 'ready' | 'signed_out';
  startupReason?: 'session_missing' | 'session_expired' | 'session_invalid';
  proxyStatus: ProxyStatus;
  connectionState: ConnectionState;
}

type MatrixLifecycleListener = (event: MatrixLifecycleEvent) => void;

export class MatrixLifecycleService {
  private runtime: MatrixRuntime | null = null;
  private listeners = new Set<MatrixLifecycleListener>();
  private snapshot: MatrixLifecycleSnapshot = {
    startupStatus: 'idle',
    proxyStatus: 'disabled',
    connectionState: 'disconnected',
  };

  constructor(private readonly deps: MatrixLifecycleDeps) {
    this.deps.matrixEventSource?.subscribe(event => {
      if (event.type === 'connectionStateChanged') {
        this.emitConnectionState(event.state);
      }
    });
  }

  isRuntimeReady(): boolean {
    return this.runtime !== null;
  }

  getSnapshot(): MatrixLifecycleSnapshot {
    return {...this.snapshot};
  }

  subscribe(listener: MatrixLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitProxyStatus(status: ProxyStatus): void {
    this.snapshot = {
      ...this.snapshot,
      proxyStatus: status,
    };

    this.listeners.forEach(listener => {
      listener({type: 'proxyStatusChanged', status});
    });
  }

  private emitConnectionState(state: ConnectionState): void {
    this.snapshot = {
      ...this.snapshot,
      connectionState: state,
    };

    this.listeners.forEach(listener => {
      listener({type: 'connectionStateChanged', state});
    });
  }

  private getRuntimeProxyStatus(runtime: MatrixRuntime): ProxyStatus {
    const maybeRuntime = runtime as unknown as {
      getProxyStatus?: () => ProxyStatus;
    };

    if (typeof maybeRuntime.getProxyStatus === 'function') {
      return maybeRuntime.getProxyStatus();
    }

    return 'disabled';
  }

  async start(
    tokenStore: MatrixSyncTokenStore,
    sessionProvider: MatrixAuthSessionProvider,
  ): Promise<MatrixStartupResult> {
    const result = await this.deps.startFromStoredSession(tokenStore, sessionProvider);

    if (result.status === 'ready') {
      this.runtime = result.boot.runtime;
      this.deps.timelineReconciliation?.start();
      this.deps.roomDirectory?.start();
      await this.deps.tokenRefresher?.refreshNow();
      this.snapshot = {
        ...this.snapshot,
        startupStatus: 'ready',
        startupReason: undefined,
      };
      this.emitProxyStatus(this.getRuntimeProxyStatus(result.boot.runtime));
      return result;
    }

    this.runtime = null;
    this.deps.timelineReconciliation?.stop();
    this.deps.roomDirectory?.stop();
    this.snapshot = {
      ...this.snapshot,
      startupStatus: 'signed_out',
      startupReason: result.reason,
    };
    this.emitProxyStatus('disabled');
    return result;
  }

  async recover(): Promise<void> {
    if (!this.runtime) {
      throw new SautiError(
        'MATRIX_RUNTIME_RECOVERY_FAILED',
        'Cannot recover Matrix before runtime is started.',
      );
    }

    await this.runtime.recoverAfterNetworkLoss();
    await this.deps.tokenRefresher?.refreshNow();
    this.emitProxyStatus(this.getRuntimeProxyStatus(this.runtime));
  }

  async logout(): Promise<MatrixLogoutReport> {
    const report = await this.deps.logoutOrchestrator.execute();
    this.deps.timelineReconciliation?.stop();
    this.deps.roomDirectory?.stop();
    this.runtime = null;
    this.snapshot = {
      ...this.snapshot,
      startupStatus: 'signed_out',
      startupReason: undefined,
      connectionState: 'disconnected',
    };
    this.emitProxyStatus('disabled');
    return report;
  }
}

export function createDefaultMatrixLifecycleService(
  dbWiper: MatrixDbWiper,
  sessionStore = new MatrixAuthSessionStore(),
  options: {
    timelineReconciliation?: {
      start(): void;
      stop(): void;
    };
    roomDirectory?: {
      start(): void;
      stop(): void;
    };
  } = {},
): MatrixLifecycleService {
  return new MatrixLifecycleService({
    startFromStoredSession: startMatrixFromStoredSession,
    logoutOrchestrator: createDefaultMatrixLogoutOrchestrator(dbWiper, sessionStore),
    tokenRefresher: new MatrixTokenRefreshService(sessionStore),
    matrixEventSource: matrixClient,
    timelineReconciliation: options.timelineReconciliation,
    roomDirectory: options.roomDirectory,
  });
}
