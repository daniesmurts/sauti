import {createCoreMessagingRuntime} from '../src/core/messaging';
import {IncomingMatrixMessage} from '../src/core/db';

describe('createCoreMessagingRuntime', () => {
  it('wires dispatch, queue processing, and timeline reconciliation for bootstrap', async () => {
    const pending = new Map<
      string,
      {
        localId: string;
        roomId: string;
        body: string;
        createdAt: number;
        attempts: number;
        nextAttemptAt: number;
      }
    >();

    const queueStore = {
      insertPending: jest.fn(async message => {
        pending.set(message.localId, message);
      }),
      listPending: jest.fn(async () => [...pending.values()]),
      markSent: jest.fn(async localId => {
        pending.delete(localId);
      }),
      markFailed: jest.fn(async localId => {
        pending.delete(localId);
      }),
      scheduleRetry: jest.fn(async (localId, attempts, nextAttemptAt) => {
        const existing = pending.get(localId);
        if (!existing) {
          return;
        }

        pending.set(localId, {
          ...existing,
          attempts,
          nextAttemptAt,
        });
      }),
    };

    const messageStatusStore = {
      insertSending: jest.fn(async () => undefined),
      markSent: jest.fn(async () => undefined),
      markFailed: jest.fn(async () => undefined),
    };

    const timelineStore = {
      upsertFromMatrixEvent: jest.fn(async () => 'inserted' as const),
    };

    let matrixListener:
      | ((event: {type: string; [key: string]: unknown}) => void)
      | null = null;

    const matrixEventSource = {
      subscribe: jest.fn(listener => {
        matrixListener = listener;
        return () => {
          matrixListener = null;
        };
      }),
    };

    let networkState: 'connected' | 'disconnected' | 'degraded' = 'connected';
    let networkListener: ((state: 'connected' | 'disconnected' | 'degraded') => void) | null = null;

    const networkMonitor = {
      getState: () => networkState,
      subscribe: jest.fn(listener => {
        networkListener = listener;
        return () => {
          networkListener = null;
        };
      }),
      start: jest.fn(),
      stop: jest.fn(),
    };

    const sender = {
      sendMessage: jest.fn(async () => ({eventId: '$event-sent'})),
    };

    const runtime = createCoreMessagingRuntime({
      currentUserIdProvider: () => '@alice:example.org',
      localIdFactory: () => 'local-fixed',
      now: () => 100,
      networkMonitor,
      queueStore,
      messageStatusStore,
      timelineStore,
      sender,
      matrixEventSource,
      database: {} as never,
    });

    runtime.start();
    await runtime.dispatch.sendText('!room:example.org', 'hello');

    expect(messageStatusStore.insertSending).toHaveBeenCalledWith({
      localId: 'local-fixed',
      roomId: '!room:example.org',
      body: 'hello',
      senderId: '@alice:example.org',
      msgType: 'm.text',
      timestamp: 100,
    });
    expect(sender.sendMessage).toHaveBeenCalledWith('!room:example.org', 'hello');
    expect(messageStatusStore.markSent).toHaveBeenCalledWith(
      'local-fixed',
      '$event-sent',
      100,
    );

    runtime.getMatrixLifecycleOptions().timelineReconciliation.start();
    matrixListener?.({
      type: 'roomMessageReceived',
      roomId: '!room:example.org',
      eventId: '$incoming-1',
      senderId: '@bob:example.org',
      body: 'incoming',
      msgType: 'm.text',
      timestamp: 200,
    });
    await Promise.resolve();

    expect(timelineStore.upsertFromMatrixEvent).toHaveBeenCalledWith(
      {
        roomId: '!room:example.org',
        eventId: '$incoming-1',
        senderId: '@bob:example.org',
        body: 'incoming',
        msgType: 'm.text',
        timestamp: 200,
      } as IncomingMatrixMessage,
      '@alice:example.org',
    );

    networkState = 'degraded';
    networkListener?.('degraded');

    runtime.stop();

    expect(networkMonitor.start).toHaveBeenCalledTimes(1);
    expect(networkMonitor.stop).toHaveBeenCalledTimes(1);
  });
});
