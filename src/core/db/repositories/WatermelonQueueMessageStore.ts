import {PendingMessage, QueueMessageStore} from '../../messaging';
import {Q} from '@nozbe/watermelondb';

interface WatermelonOutgoingMessageRecord {
  local_id: string;
  room_id: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  next_attempt_at: number;
  created_at: number;
  updated_at: number;
  matrix_event_id?: string;
  last_error?: string;
  update(updater: () => void): Promise<void>;
}

interface WatermelonOutgoingMessageModel {
  _raw: {
    local_id?: string;
    room_id?: string;
    body?: string;
    status?: 'pending' | 'sent' | 'failed';
    attempts?: number;
    next_attempt_at?: number;
    created_at?: number;
    updated_at?: number;
    matrix_event_id?: string;
    last_error?: string;
  };
  update(updater: () => void): Promise<void>;
}

interface WatermelonCollectionLike {
  database: {
    write<T>(action: () => Promise<T> | T): Promise<T>;
  };
  create(builder: (record: WatermelonOutgoingMessageModel) => void): Promise<void>;
  query(...conditions: unknown[]): {
    fetch(): Promise<WatermelonOutgoingMessageModel[]>;
  };
}

interface WatermelonDatabaseLike {
  get(table: 'outgoing_messages'): WatermelonCollectionLike;
}

export interface WatermelonOutgoingMessageCollection {
  create(builder: (record: WatermelonOutgoingMessageRecord) => void): Promise<void>;
  findByLocalId(localId: string): Promise<WatermelonOutgoingMessageRecord | null>;
  listByStatus(status: 'pending' | 'sent' | 'failed'): Promise<WatermelonOutgoingMessageRecord[]>;
}

function toRecordProxy(
  model: WatermelonOutgoingMessageModel,
): WatermelonOutgoingMessageRecord {
  const proxy = {
    get local_id() {
      return model._raw.local_id ?? '';
    },
    set local_id(value: string) {
      model._raw.local_id = value;
    },
    get room_id() {
      return model._raw.room_id ?? '';
    },
    set room_id(value: string) {
      model._raw.room_id = value;
    },
    get body() {
      return model._raw.body ?? '';
    },
    set body(value: string) {
      model._raw.body = value;
    },
    get status() {
      return model._raw.status ?? 'pending';
    },
    set status(value: 'pending' | 'sent' | 'failed') {
      model._raw.status = value;
    },
    get attempts() {
      return model._raw.attempts ?? 0;
    },
    set attempts(value: number) {
      model._raw.attempts = value;
    },
    get next_attempt_at() {
      return model._raw.next_attempt_at ?? 0;
    },
    set next_attempt_at(value: number) {
      model._raw.next_attempt_at = value;
    },
    get created_at() {
      return model._raw.created_at ?? 0;
    },
    set created_at(value: number) {
      model._raw.created_at = value;
    },
    get updated_at() {
      return model._raw.updated_at ?? 0;
    },
    set updated_at(value: number) {
      model._raw.updated_at = value;
    },
    get matrix_event_id() {
      return model._raw.matrix_event_id;
    },
    set matrix_event_id(value: string | undefined) {
      model._raw.matrix_event_id = value;
    },
    get last_error() {
      return model._raw.last_error;
    },
    set last_error(value: string | undefined) {
      model._raw.last_error = value;
    },
    async update(updater: () => void): Promise<void> {
      await model.update(() => {
        updater();
      });
    },
  };

  return proxy;
}

export function createWatermelonOutgoingMessageCollection(
  database: WatermelonDatabaseLike,
): WatermelonOutgoingMessageCollection {
  const collection = database.get('outgoing_messages');

  return {
    async create(builder) {
      await collection.database.write(async () => {
        await collection.create(model => {
          builder(toRecordProxy(model));
        });
      });
    },
    async findByLocalId(localId) {
      const rows = await collection.query(Q.where('local_id', localId)).fetch();
      const model = rows[0];
      return model ? toRecordProxy(model) : null;
    },
    async listByStatus(status) {
      const rows = await collection.query(Q.where('status', status)).fetch();
      return rows.map(row => toRecordProxy(row));
    },
  };
}

export class WatermelonQueueMessageStore implements QueueMessageStore {
  constructor(private readonly outbox: WatermelonOutgoingMessageCollection) {}

  async insertPending(message: PendingMessage): Promise<void> {
    await this.outbox.create(record => {
      record.local_id = message.localId;
      record.room_id = message.roomId;
      record.body = message.body;
      record.status = 'pending';
      record.attempts = message.attempts;
      record.next_attempt_at = message.nextAttemptAt;
      record.created_at = message.createdAt;
      record.updated_at = message.createdAt;
    });
  }

  async listPending(): Promise<PendingMessage[]> {
    const pending = await this.outbox.listByStatus('pending');
    return pending.map(record => ({
      localId: record.local_id,
      roomId: record.room_id,
      body: record.body,
      createdAt: record.created_at,
      attempts: record.attempts,
      nextAttemptAt: record.next_attempt_at,
    }));
  }

  async markSent(localId: string, matrixEventId: string, sentAt: number): Promise<void> {
    const record = await this.mustFind(localId);

    await record.update(() => {
      record.status = 'sent';
      record.matrix_event_id = matrixEventId;
      record.updated_at = sentAt;
    });
  }

  async markFailed(localId: string, reason: string, failedAt: number): Promise<void> {
    const record = await this.mustFind(localId);

    await record.update(() => {
      record.status = 'failed';
      record.last_error = reason;
      record.updated_at = failedAt;
    });
  }

  async scheduleRetry(
    localId: string,
    attempts: number,
    nextAttemptAt: number,
    reason: string,
  ): Promise<void> {
    const record = await this.mustFind(localId);

    await record.update(() => {
      record.status = 'pending';
      record.attempts = attempts;
      record.next_attempt_at = nextAttemptAt;
      record.last_error = reason;
      record.updated_at = nextAttemptAt;
    });
  }

  private async mustFind(localId: string): Promise<WatermelonOutgoingMessageRecord> {
    const record = await this.outbox.findByLocalId(localId);
    if (!record) {
      throw new Error(`Outgoing message not found: ${localId}`);
    }

    return record;
  }
}
