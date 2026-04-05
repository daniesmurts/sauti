import {AppNetworkState} from '../network';

export interface PendingMessage {
  localId: string;
  roomId: string;
  body: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
}

export interface QueueMessageStore {
  insertPending(message: PendingMessage): Promise<void>;
  listPending(): Promise<PendingMessage[]>;
  markSent(localId: string, matrixEventId: string, sentAt: number): Promise<void>;
  markFailed(localId: string, reason: string, failedAt: number): Promise<void>;
  scheduleRetry(
    localId: string,
    attempts: number,
    nextAttemptAt: number,
    reason: string,
  ): Promise<void>;
}

export interface MatrixMessageSender {
  sendMessage(roomId: string, body: string): Promise<{eventId: string}>;
}

export interface NetworkStateSource {
  getState(): AppNetworkState;
  subscribe(listener: (state: AppNetworkState) => void): () => void;
}

export interface OutgoingMessageLifecycleSink {
  markSent(localId: string, matrixEventId: string, sentAt: number): Promise<void>;
  markFailed(localId: string, failedAt: number): Promise<void>;
}

interface QueueOptions {
  now?: () => number;
  setTimer?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  failAfterMs?: number;
  lifecycleSink?: OutgoingMessageLifecycleSink;
}

const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const DEFAULT_FAIL_AFTER_MS = 72 * 60 * 60 * 1000;

export class OutgoingMessageQueue {
  private readonly now: () => number;
  private readonly setTimer: (
    callback: () => void,
    timeoutMs: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;

  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly failAfterMs: number;
  private readonly lifecycleSink?: OutgoingMessageLifecycleSink;

  private processing = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeNetwork: (() => void) | null = null;

  constructor(
    private readonly store: QueueMessageStore,
    private readonly sender: MatrixMessageSender,
    private readonly network: NetworkStateSource,
    options: QueueOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
    this.initialRetryDelayMs =
      options.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.failAfterMs = options.failAfterMs ?? DEFAULT_FAIL_AFTER_MS;
    this.lifecycleSink = options.lifecycleSink;
  }

  start(): void {
    if (this.unsubscribeNetwork) {
      return;
    }

    this.unsubscribeNetwork = this.network.subscribe(state => {
      if (state === 'connected' || state === 'degraded') {
        void this.processNow();
      }
    });

    if (this.network.getState() === 'connected' || this.network.getState() === 'degraded') {
      void this.processNow();
    }
  }

  stop(): void {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }

    if (this.retryTimer) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async enqueue(localId: string, roomId: string, body: string): Promise<void> {
    const now = this.now();
    await this.store.insertPending({
      localId,
      roomId,
      body,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: now,
    });

    if (this.network.getState() === 'connected' || this.network.getState() === 'degraded') {
      await this.processNow();
    }
  }

  async processNow(): Promise<void> {
    if (this.processing) {
      return;
    }

    if (this.network.getState() === 'disconnected') {
      return;
    }

    this.processing = true;

    try {
      const now = this.now();
      const pending = (await this.store.listPending()).sort(
        (a, b) => a.createdAt - b.createdAt,
      );

      let nextAttemptAt: number | null = null;

      for (const message of pending) {
        if (message.nextAttemptAt > now) {
          nextAttemptAt =
            nextAttemptAt === null
              ? message.nextAttemptAt
              : Math.min(nextAttemptAt, message.nextAttemptAt);
          continue;
        }

        if (now - message.createdAt >= this.failAfterMs) {
          await this.store.markFailed(
            message.localId,
            'Message expired after retry window.',
            now,
          );
          if (this.lifecycleSink) {
            await this.lifecycleSink.markFailed(message.localId, now);
          }
          continue;
        }

        try {
          const sent = await this.sender.sendMessage(message.roomId, message.body);
          await this.store.markSent(message.localId, sent.eventId, now);
          if (this.lifecycleSink) {
            await this.lifecycleSink.markSent(message.localId, sent.eventId, now);
          }
        } catch (error) {
          const attempts = message.attempts + 1;
          const delay = Math.min(
            this.initialRetryDelayMs * 2 ** Math.max(0, attempts - 1),
            this.maxRetryDelayMs,
          );
          const retryAt = now + delay;

          await this.store.scheduleRetry(
            message.localId,
            attempts,
            retryAt,
            error instanceof Error ? error.message : 'Unknown send error',
          );

          nextAttemptAt =
            nextAttemptAt === null ? retryAt : Math.min(nextAttemptAt, retryAt);
        }
      }

      this.scheduleNext(nextAttemptAt);
    } finally {
      this.processing = false;
    }
  }

  private scheduleNext(nextAttemptAt: number | null): void {
    if (this.retryTimer) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }

    if (nextAttemptAt === null) {
      return;
    }

    const delay = Math.max(0, nextAttemptAt - this.now());
    this.retryTimer = this.setTimer(() => {
      void this.processNow();
    }, delay);
  }
}
