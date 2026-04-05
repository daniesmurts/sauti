import {
  WatermelonQueueMessageStore,
  WatermelonOutgoingMessageCollection,
} from '../src/core/db';

function createInMemoryOutbox(): WatermelonOutgoingMessageCollection {
  const records: Array<{
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
  }> = [];

  return {
    async create(builder) {
      const record = {
        local_id: '',
        room_id: '',
        body: '',
        status: 'pending' as const,
        attempts: 0,
        next_attempt_at: 0,
        created_at: 0,
        updated_at: 0,
        async update(updater: () => void) {
          updater();
        },
      };

      builder(record);
      records.push(record);
    },
    async findByLocalId(localId) {
      return records.find(record => record.local_id === localId) ?? null;
    },
    async listByStatus(status) {
      return records.filter(record => record.status === status);
    },
  };
}

describe('WatermelonQueueMessageStore', () => {
  it('creates pending records and lists pending queue messages', async () => {
    const store = new WatermelonQueueMessageStore(createInMemoryOutbox());

    await store.insertPending({
      localId: 'local-1',
      roomId: '!room:example.org',
      body: 'hello',
      createdAt: 10,
      attempts: 0,
      nextAttemptAt: 10,
    });

    await store.insertPending({
      localId: 'local-2',
      roomId: '!room:example.org',
      body: 'world',
      createdAt: 20,
      attempts: 1,
      nextAttemptAt: 30,
    });

    await store.markSent('local-2', '$event2', 50);

    const pending = await store.listPending();

    expect(pending).toEqual([
      {
        localId: 'local-1',
        roomId: '!room:example.org',
        body: 'hello',
        createdAt: 10,
        attempts: 0,
        nextAttemptAt: 10,
      },
    ]);
  });

  it('updates retry metadata and failed status', async () => {
    const collection = createInMemoryOutbox();
    const store = new WatermelonQueueMessageStore(collection);

    await store.insertPending({
      localId: 'local-3',
      roomId: '!room:example.org',
      body: 'retry',
      createdAt: 100,
      attempts: 0,
      nextAttemptAt: 100,
    });

    await store.scheduleRetry('local-3', 2, 500, 'temporary failure');

    let pending = await store.listPending();
    expect(pending[0]).toMatchObject({
      localId: 'local-3',
      attempts: 2,
      nextAttemptAt: 500,
    });

    await store.markFailed('local-3', 'expired', 2000);

    pending = await store.listPending();
    expect(pending).toEqual([]);
  });
});
