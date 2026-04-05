import {Q} from '@nozbe/watermelondb';

export interface IncomingMatrixMessage {
  roomId: string;
  eventId: string;
  senderId: string;
  body: string;
  msgType: string;
  timestamp: number;
}

export interface MessageTimelineStore {
  upsertFromMatrixEvent(
    message: IncomingMatrixMessage,
    currentUserId: string,
  ): Promise<'inserted' | 'updated'>;
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

export class WatermelonMessageTimelineStore implements MessageTimelineStore {
  constructor(private readonly messages: WatermelonMessagesCollectionLike) {}

  async upsertFromMatrixEvent(
    message: IncomingMatrixMessage,
    currentUserId: string,
  ): Promise<'inserted' | 'updated'> {
    const existing = await this.findByEventId(message.eventId);
    const status =
      message.senderId === currentUserId
        ? 'delivered'
        : 'delivered';

    if (existing) {
      await existing.update(() => {
        existing._raw.room_id = message.roomId;
        existing._raw.sender_id = message.senderId;
        existing._raw.body = message.body;
        existing._raw.msg_type = message.msgType;
        existing._raw.timestamp = message.timestamp;
        if (existing._raw.status !== 'failed') {
          existing._raw.status = status;
        }
        existing._raw.is_read = message.senderId === currentUserId;
      });

      return 'updated';
    }

    await this.messages.database.write(async () => {
      await this.messages.create(record => {
        record._raw.matrix_event_id = message.eventId;
        record._raw.room_id = message.roomId;
        record._raw.sender_id = message.senderId;
        record._raw.body = message.body;
        record._raw.msg_type = message.msgType;
        record._raw.status = status;
        record._raw.timestamp = message.timestamp;
        record._raw.is_read = message.senderId === currentUserId;
      });
    });

    return 'inserted';
  }

  private async findByEventId(
    eventId: string,
  ): Promise<WatermelonMessageModel | null> {
    const rows = await this.messages.query(Q.where('matrix_event_id', eventId)).fetch();
    return rows[0] ?? null;
  }
}

export function createWatermelonMessageTimelineStore(
  database: WatermelonDatabaseLike,
): WatermelonMessageTimelineStore {
  return new WatermelonMessageTimelineStore(database.get('messages'));
}
