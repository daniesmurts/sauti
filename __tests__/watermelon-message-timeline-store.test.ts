import {createWatermelonMessageTimelineStore} from '../src/core/db';

describe('WatermelonMessageTimelineStore', () => {
  it('inserts new message events and updates existing rows idempotently', async () => {
    const rows: Array<{
      _raw: Record<string, unknown>;
      update: (updater: () => void) => Promise<void>;
    }> = [];

    const messagesCollection = {
      database: {
        write: async <T>(action: () => Promise<T> | T): Promise<T> => action(),
      },
      create: async (
        builder: (model: {
          _raw: Record<string, unknown>;
          update: (updater: () => void) => Promise<void>;
        }) => void,
      ) => {
        const model = {
          _raw: {},
          async update(updater: () => void) {
            updater();
          },
        };
        builder(model);
        rows.push(model);
      },
      query: jest.fn().mockImplementation(() => ({
        fetch: async () => rows,
      })),
    };

    const database = {
      get: () => messagesCollection,
    };

    const store = createWatermelonMessageTimelineStore(
      database as unknown as Parameters<typeof createWatermelonMessageTimelineStore>[0],
    );

    const firstResult = await store.upsertFromMatrixEvent(
      {
        roomId: '!room:example.org',
        eventId: '$event-1',
        senderId: '@bob:example.org',
        body: 'hello',
        msgType: 'm.text',
        timestamp: 10,
      },
      '@alice:example.org',
    );

    expect(firstResult).toBe('inserted');
    expect(rows).toHaveLength(1);
    expect(rows[0]._raw.matrix_event_id).toBe('$event-1');
    expect(rows[0]._raw.status).toBe('sent');
    expect(rows[0]._raw.is_read).toBe(false);

    const secondResult = await store.upsertFromMatrixEvent(
      {
        roomId: '!room:example.org',
        eventId: '$event-1',
        senderId: '@alice:example.org',
        body: 'edited body',
        msgType: 'm.text',
        timestamp: 20,
      },
      '@alice:example.org',
    );

    expect(secondResult).toBe('updated');
    expect(rows).toHaveLength(1);
    expect(rows[0]._raw.body).toBe('edited body');
    expect(rows[0]._raw.timestamp).toBe(20);
    expect(rows[0]._raw.is_read).toBe(true);
  });
});
