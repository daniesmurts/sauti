import {
  OutgoingMessageQueue,
  PendingMessage,
  QueueMessageStore,
} from '../src/core/messaging';

class InMemoryQueueStore implements QueueMessageStore {
  pending = new Map<string, PendingMessage>();
  sent: string[] = [];
  failed: string[] = [];

  async insertPending(message: PendingMessage): Promise<void> {
    this.pending.set(message.localId, message);
  }

  async listPending(): Promise<PendingMessage[]> {
    return [...this.pending.values()];
  }

  async markSent(localId: string): Promise<void> {
    this.pending.delete(localId);
    this.sent.push(localId);
  }

  async markFailed(localId: string): Promise<void> {
    this.pending.delete(localId);
    this.failed.push(localId);
  }

  async scheduleRetry(
    localId: string,
    attempts: number,
    nextAttemptAt: number,
  ): Promise<void> {
    const existing = this.pending.get(localId);
    if (!existing) {
      return;
    }

    this.pending.set(localId, {
      ...existing,
      attempts,
      nextAttemptAt,
    });
  }
}

describe('OutgoingMessageQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('enqueues offline and sends when network becomes connected', async () => {
    const store = new InMemoryQueueStore();
    let networkState: 'connected' | 'disconnected' | 'degraded' = 'disconnected';
    let networkListener: ((state: 'connected' | 'disconnected' | 'degraded') => void) |
      null = null;

    const sender = {
      sendMessage: jest.fn().mockResolvedValue({eventId: '$1'}),
    };
    const lifecycleSink = {
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    const queue = new OutgoingMessageQueue(
      store,
      sender,
      {
        getState: () => networkState,
        subscribe: listener => {
          networkListener = listener;
          return () => {
            networkListener = null;
          };
        },
      },
      {now: () => 1000, lifecycleSink},
    );

    queue.start();
    await queue.enqueue('local-1', '!room:example.org', 'hello');

    expect(sender.sendMessage).not.toHaveBeenCalled();

    networkState = 'connected';
    await queue.processNow();

    expect(sender.sendMessage).toHaveBeenCalledWith('!room:example.org', 'hello');
    expect(store.sent).toEqual(['local-1']);
    expect(lifecycleSink.markSent).toHaveBeenCalledWith('local-1', '$1', 1000);
    expect(lifecycleSink.markFailed).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff and eventually succeeds', async () => {
    const store = new InMemoryQueueStore();
    let now = 1000;

    const sender = {
      sendMessage: jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce({eventId: '$2'}),
    };

    const queue = new OutgoingMessageQueue(
      store,
      sender,
      {
        getState: () => 'connected',
        subscribe: () => () => undefined,
      },
      {
        now: () => now,
        initialRetryDelayMs: 1000,
      },
    );

    queue.start();
    await queue.enqueue('local-2', '!room:example.org', 'retry me');

    expect(sender.sendMessage).toHaveBeenCalledTimes(1);

    now += 1000;
    await jest.advanceTimersByTimeAsync(1000);
    await Promise.resolve();

    expect(sender.sendMessage).toHaveBeenCalledTimes(2);
    expect(store.sent).toEqual(['local-2']);
  });

  it('marks messages failed after retry window', async () => {
    const store = new InMemoryQueueStore();
    let now = 1000;

    const sender = {
      sendMessage: jest.fn().mockRejectedValue(new Error('always fails')),
    };
    const lifecycleSink = {
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    const queue = new OutgoingMessageQueue(
      store,
      sender,
      {
        getState: () => 'connected',
        subscribe: () => () => undefined,
      },
      {
        now: () => now,
        failAfterMs: 100,
        initialRetryDelayMs: 10,
        lifecycleSink,
      },
    );

    queue.start();
    await queue.enqueue('local-3', '!room:example.org', 'expire me');

    now += 10;
    await jest.advanceTimersByTimeAsync(10);
    await Promise.resolve();

    now += 200;
    await queue.processNow();

    expect(store.failed).toEqual(['local-3']);
    expect(lifecycleSink.markFailed).toHaveBeenCalledWith('local-3', 1210);
    expect(lifecycleSink.markSent).not.toHaveBeenCalled();
  });
});
