import {
  createSautiDatabase,
  createWatermelonMessageStore,
  createWatermelonQueueStore,
  createWatermelonRoomStore,
  createWatermelonTimelineStore,
  MessageStatusStore,
  RoomDirectoryStore,
  MessageTimelineStore,
} from '../db';
import {matrixClient} from '../matrix';

import {MatrixRoomDirectoryService} from './MatrixRoomDirectoryService';
import {MatrixMessageSenderAdapter, MatrixTextMessageClient} from './MatrixMessageSenderAdapter';
import {MatrixEventSource, MatrixTimelineReconciliationService} from './MatrixTimelineReconciliationService';
import {DispatchOptions, MessageDispatchService} from './MessageDispatchService';
import {MatrixMessageSender, OutgoingMessageQueue, QueueMessageStore} from './OutgoingMessageQueue';

type WatermelonDatabase = Parameters<typeof createWatermelonQueueStore>[0];
type AppNetworkState = 'connected' | 'disconnected' | 'degraded';

export interface CoreMessagingRuntimeOptions {
  currentUserIdProvider: () => string;
  localIdFactory?: DispatchOptions['localIdFactory'];
  now?: () => number;
  dbName?: string;
  database?: WatermelonDatabase;
  networkMonitor?: {
    getState(): AppNetworkState;
    subscribe(listener: (state: AppNetworkState) => void): () => void;
    start(): void;
    stop(): void;
  };
  queueStore?: QueueMessageStore;
  messageStatusStore?: MessageStatusStore;
  timelineStore?: MessageTimelineStore;
  roomStore?: RoomDirectoryStore;
  sender?: MatrixMessageSender;
  matrixTextClient?: MatrixTextMessageClient;
  matrixEventSource?: MatrixEventSource;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  failAfterMs?: number;
}

export interface CoreMessagingRuntime {
  database: WatermelonDatabase;
  dispatch: MessageDispatchService;
  queue: OutgoingMessageQueue;
  timelineReconciliation: MatrixTimelineReconciliationService;
  roomDirectory: MatrixRoomDirectoryService;
  start(): void;
  stop(): void;
  getMatrixLifecycleOptions(): {
    timelineReconciliation: {
      start(): void;
      stop(): void;
    };
    roomDirectory: {
      start(): void;
      stop(): void;
    };
  };
}

export function createCoreMessagingRuntime(
  options: CoreMessagingRuntimeOptions,
): CoreMessagingRuntime {
  let database = options.database;

  const getDatabase = (): WatermelonDatabase => {
    if (!database) {
      database = createSautiDatabase({dbName: options.dbName});
    }

    return database;
  };

  const networkMonitor =
    options.networkMonitor ??
    // Lazy require avoids loading NetInfo native module in tests that only import the barrel.
    new (require('../network').NetworkMonitor)();
  const messageStatusStore =
    options.messageStatusStore ??
    createWatermelonMessageStore(getDatabase());
  const queueStore =
    options.queueStore ??
    createWatermelonQueueStore(getDatabase());
  const timelineStore =
    options.timelineStore ??
    createWatermelonTimelineStore(getDatabase());
  const roomStore =
    options.roomStore ??
    ((): RoomDirectoryStore => {
      const candidate = getDatabase() as unknown as {get?: unknown};
      if (typeof candidate.get === 'function') {
        return createWatermelonRoomStore(getDatabase());
      }

      return {
        async upsertRoomMembership() {
          return;
        },
        async touchLastEventAt() {
          return;
        },
        async listRooms() {
          return [];
        },
      };
    })();

  const sender =
    options.sender ??
    new MatrixMessageSenderAdapter(options.matrixTextClient ?? matrixClient);

  const queue = new OutgoingMessageQueue(
    queueStore,
    sender,
    networkMonitor,
    {
      now: options.now,
      initialRetryDelayMs: options.initialRetryDelayMs,
      maxRetryDelayMs: options.maxRetryDelayMs,
      failAfterMs: options.failAfterMs,
      lifecycleSink: messageStatusStore,
    },
  );

  const dispatch = new MessageDispatchService(queue, {
    localIdFactory: options.localIdFactory,
    now: options.now,
    senderIdProvider: options.currentUserIdProvider,
    statusStore: messageStatusStore,
  });

  const timelineReconciliation = new MatrixTimelineReconciliationService(
    options.matrixEventSource ?? matrixClient,
    timelineStore,
    options.currentUserIdProvider,
  );

  const roomDirectory = new MatrixRoomDirectoryService(
    options.matrixEventSource ?? matrixClient,
    roomStore,
    options.now ?? Date.now,
  );

  return {
    database: getDatabase(),
    dispatch,
    queue,
    timelineReconciliation,
    roomDirectory,
    start() {
      networkMonitor.start();
      queue.start();
    },
    stop() {
      queue.stop();
      timelineReconciliation.stop();
      roomDirectory.stop();
      networkMonitor.stop();
    },
    getMatrixLifecycleOptions() {
      return {
        timelineReconciliation,
        roomDirectory,
      };
    },
  };
}
