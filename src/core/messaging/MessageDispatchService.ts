import {OutgoingMessageQueue} from './OutgoingMessageQueue';

export interface MessageDispatchResult {
  localId: string;
}

export interface DispatchOptions {
  localIdFactory?: () => string;
  now?: () => number;
  senderIdProvider?: () => string;
  statusStore?: {
    insertSending(message: {
      localId: string;
      roomId: string;
      body: string;
      senderId: string;
      msgType: string;
      timestamp: number;
    }): Promise<void>;
  };
}

export class MessageDispatchService {
  private readonly localIdFactory: () => string;
  private readonly now: () => number;
  private readonly senderIdProvider: () => string;
  private readonly statusStore?: DispatchOptions['statusStore'];

  constructor(
    private readonly queue: OutgoingMessageQueue,
    options: DispatchOptions = {},
  ) {
    this.localIdFactory =
      options.localIdFactory ??
      (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    this.now = options.now ?? Date.now;
    this.senderIdProvider = options.senderIdProvider ?? (() => 'self');
    this.statusStore = options.statusStore;
  }

  async sendText(roomId: string, body: string): Promise<MessageDispatchResult> {
    const localId = this.localIdFactory();
    if (this.statusStore) {
      await this.statusStore.insertSending({
        localId,
        roomId,
        body,
        senderId: this.senderIdProvider(),
        msgType: 'm.text',
        timestamp: this.now(),
      });
    }
    await this.queue.enqueue(localId, roomId, body);
    return {localId};
  }
}
