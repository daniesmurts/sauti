import {
  MessageDispatchService,
  OutgoingMessageQueue,
  PendingMessage,
  QueueMessageStore,
} from '../src/core/messaging';

class PersistentQueueStore implements QueueMessageStore {
  readonly pending = new Map<string, PendingMessage>();

  async insertPending(message: PendingMessage): Promise<void> {
    this.pending.set(message.localId, message);
  }

  async listPending(): Promise<PendingMessage[]> {
    return [...this.pending.values()];
  }

  async markSent(localId: string): Promise<void> {
    this.pending.delete(localId);
  }

  async markFailed(localId: string): Promise<void> {
    this.pending.delete(localId);
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

describe('offline message lifecycle integration', () => {
  it('keeps sending state across queue restart and marks sent when network is restored', async () => {
    const queueStore = new PersistentQueueStore();
    const messageRows = new Map<
      string,
      {status: 'sending' | 'sent' | 'failed'; matrixEventId?: string}
    >();

    let now = 1000;
    let networkState: 'connected' | 'disconnected' | 'degraded' = 'disconnected';

    const sender = {
      sendMessage: jest
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({eventId: '$event-after-restart'}),
    };

    const lifecycleSink = {
      markSent: jest
        .fn()
        .mockImplementation(async (localId: string, eventId: string) => {
          const row = messageRows.get(localId);
          if (!row) {
            throw new Error('missing row');
          }
          row.status = 'sent';
          row.matrixEventId = eventId;
        }),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    const dispatch = new MessageDispatchService(
      new OutgoingMessageQueue(
        queueStore,
        sender,
        {
          getState: () => networkState,
          subscribe: () => () => undefined,
        },
        {
          now: () => now,
          initialRetryDelayMs: 1000,
          lifecycleSink,
        },
      ),
      {
        localIdFactory: () => 'local-1',
        now: () => now,
        senderIdProvider: () => '@alice:example.org',
        statusStore: {
          insertSending: async ({localId}) => {
            messageRows.set(localId, {status: 'sending'});
          },
        },
      },
    );

    await dispatch.sendText('!room:example.org', 'hello while offline');
    expect(messageRows.get('local-1')?.status).toBe('sending');

    networkState = 'connected';
    const restartedQueue = new OutgoingMessageQueue(
      queueStore,
      sender,
      {
        getState: () => networkState,
        subscribe: () => () => undefined,
      },
      {
        now: () => now,
        lifecycleSink,
      },
    );

    await restartedQueue.processNow();
    expect(messageRows.get('local-1')?.status).toBe('sending');

    now += 1000;
    await restartedQueue.processNow();

    expect(messageRows.get('local-1')).toEqual({
      status: 'sent',
      matrixEventId: '$event-after-restart',
    });
    expect(queueStore.pending.size).toBe(0);
  });
});
