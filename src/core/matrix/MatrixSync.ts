import {SautiError} from './MatrixClient';

export type SyncLifecycleState = 'idle' | 'running' | 'paused' | 'stopped';

export interface MatrixSyncTokenStore {
  getSyncToken(): Promise<string | null>;
  saveSyncToken(token: string): Promise<void>;
}

export interface MatrixSyncClient {
  startClient(options?: Record<string, unknown>): void;
  stopClient(): void;
}

export interface MatrixSyncTokenSource {
  subscribe(listener: (token: string) => void): () => void;
}

interface MatrixSyncOptions {
  debounceMs?: number;
  backgroundPauseThresholdMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  tokenSource?: MatrixSyncTokenSource;
}

const DEFAULT_DEBOUNCE_MS = 200;
const DEFAULT_BACKGROUND_PAUSE_THRESHOLD_MS = 10 * 60 * 1000;

export class MatrixSync {
  private readonly debounceMs: number;
  private readonly backgroundPauseThresholdMs: number;
  private readonly now: () => number;
  private readonly setTimer: (
    callback: () => void,
    timeoutMs: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;

  private state: SyncLifecycleState = 'idle';
  private backgroundSinceMs: number | null = null;
  private pendingToken: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenUnsubscribe: (() => void) | null = null;
  private readonly tokenSource?: MatrixSyncTokenSource;

  constructor(
    private readonly client: MatrixSyncClient,
    private readonly tokenStore: MatrixSyncTokenStore,
    options: MatrixSyncOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.backgroundPauseThresholdMs =
      options.backgroundPauseThresholdMs ?? DEFAULT_BACKGROUND_PAUSE_THRESHOLD_MS;
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.tokenSource = options.tokenSource;
  }

  getState(): SyncLifecycleState {
    return this.state;
  }

  async start(): Promise<void> {
    try {
      const lastSyncToken = await this.tokenStore.getSyncToken();
      const startOptions: Record<string, unknown> = {
        initialSyncLimit: 20,
      };

      if (lastSyncToken) {
        startOptions.since = lastSyncToken;
      }

      this.client.startClient(startOptions);
      this.bindTokenSource();
      this.state = 'running';
    } catch (error) {
      throw new SautiError(
        'MATRIX_SYNC_START_FAILED',
        'Failed to start Matrix sync.',
        error,
      );
    }
  }

  stop(): void {
    try {
      this.client.stopClient();
      this.state = 'stopped';
      this.backgroundSinceMs = null;
      this.clearPendingFlushTimer();
      this.unbindTokenSource();
    } catch (error) {
      throw new SautiError(
        'MATRIX_SYNC_STOP_FAILED',
        'Failed to stop Matrix sync.',
        error,
      );
    }
  }

  pause(): void {
    if (this.state !== 'running') {
      return;
    }

    this.stop();
    this.state = 'paused';
  }

  onSyncTokenUpdated(token: string): void {
    this.pendingToken = token;

    if (this.flushTimer) {
      this.clearTimer(this.flushTimer);
    }

    this.flushTimer = this.setTimer(() => {
      void this.flushPendingToken();
    }, this.debounceMs);
  }

  onAppStateChanged(state: 'active' | 'background' | 'inactive'): void {
    if (state === 'background') {
      this.backgroundSinceMs = this.now();
      return;
    }

    if (state !== 'active') {
      return;
    }

    if (this.backgroundSinceMs === null) {
      return;
    }

    const backgroundDurationMs = this.now() - this.backgroundSinceMs;
    this.backgroundSinceMs = null;

    if (backgroundDurationMs >= this.backgroundPauseThresholdMs) {
      this.pause();
    }
  }

  async flushPendingToken(): Promise<void> {
    if (!this.pendingToken) {
      this.flushTimer = null;
      return;
    }

    const tokenToPersist = this.pendingToken;
    this.pendingToken = null;
    this.flushTimer = null;

    try {
      await this.tokenStore.saveSyncToken(tokenToPersist);
    } catch (error) {
      throw new SautiError(
        'MATRIX_SYNC_TOKEN_PERSIST_FAILED',
        'Failed to persist Matrix sync token.',
        error,
      );
    }
  }

  private clearPendingFlushTimer(): void {
    if (!this.flushTimer) {
      return;
    }

    this.clearTimer(this.flushTimer);
    this.flushTimer = null;
  }

  private bindTokenSource(): void {
    if (!this.tokenSource || this.tokenUnsubscribe) {
      return;
    }

    this.tokenUnsubscribe = this.tokenSource.subscribe(token => {
      this.onSyncTokenUpdated(token);
    });
  }

  private unbindTokenSource(): void {
    if (!this.tokenUnsubscribe) {
      return;
    }

    this.tokenUnsubscribe();
    this.tokenUnsubscribe = null;
  }
}
