import {Q} from '@nozbe/watermelondb';

export interface OutgoingMessageLifecycleRecord {
  localId: string;
  roomId: string;
  body: string;
  senderId: string;
  msgType: string;
  timestamp: number;
}

export interface MessageStatusStore {
  insertSending(message: OutgoingMessageLifecycleRecord): Promise<void>;
  markSent(localId: string, matrixEventId: string, sentAt: number): Promise<void>;
  markFailed(localId: string, failedAt: number): Promise<void>;
}

interface WatermelonMessageModel {
  _raw: {
    local_id?: string;
    matrix_event_id?: string;
    room_id?: string;
    sender_id?: string;
    body?: string;
    msg_type?: string;
    status?: 'sending' | 'sent' | 'delivered' | 'failed';
    timestamp?: number;
    is_read?: boolean;
  };
  update(updater: () => void): Promise<void>;
}

interface WatermelonMessagesCollectionLike {
  database: {
    write<T>(action: () => Promise<T> | T): Promise<T>;
  };
  create(builder: (record: WatermelonMessageModel) => void): Promise<void>;
  query(...conditions: unknown[]): {
    fetch(): Promise<WatermelonMessageModel[]>;
  };
}

interface WatermelonDatabaseLike {
  get(table: 'messages'): WatermelonMessagesCollectionLike;
}

export class WatermelonMessageStatusStore implements MessageStatusStore {
  constructor(private readonly messages: WatermelonMessagesCollectionLike) {}

  async insertSending(message: OutgoingMessageLifecycleRecord): Promise<void> {
    await this.messages.database.write(async () => {
      await this.messages.create(record => {
        record._raw.local_id = message.localId;
        record._raw.room_id = message.roomId;
        record._raw.sender_id = message.senderId;
        record._raw.body = message.body;
        record._raw.msg_type = message.msgType;
        record._raw.status = 'sending';
        record._raw.timestamp = message.timestamp;
        record._raw.is_read = true;
      });
    });
  }

  async markSent(localId: string, matrixEventId: string, sentAt: number): Promise<void> {
    const row = await this.mustFindByLocalId(localId);
    await row.update(() => {
      row._raw.status = 'sent';
      row._raw.matrix_event_id = matrixEventId;
      row._raw.timestamp = sentAt;
    });
  }

  async markFailed(localId: string, failedAt: number): Promise<void> {
    const row = await this.mustFindByLocalId(localId);
    await row.update(() => {
      row._raw.status = 'failed';
      row._raw.timestamp = failedAt;
    });
  }

  private async mustFindByLocalId(localId: string): Promise<WatermelonMessageModel> {
    const rows = await this.messages.query(Q.where('local_id', localId)).fetch();
    const row = rows[0];
    if (!row) {
      throw new Error(`Message not found for localId: ${localId}`);
    }

    return row;
  }
}

export function createWatermelonMessageStatusStore(
  database: WatermelonDatabaseLike,
): WatermelonMessageStatusStore {
  return new WatermelonMessageStatusStore(database.get('messages'));
}
