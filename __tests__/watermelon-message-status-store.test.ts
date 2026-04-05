import {createWatermelonMessageStatusStore} from '../src/core/db';

describe('WatermelonMessageStatusStore', () => {
  it('persists sending, sent, and failed message state transitions', async () => {
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

    const store = createWatermelonMessageStatusStore(
      database as unknown as Parameters<typeof createWatermelonMessageStatusStore>[0],
    );

    await store.insertSending({
      localId: 'local-1',
      roomId: '!room:example.org',
      body: 'hello',
      senderId: '@alice:example.org',
      msgType: 'm.text',
      timestamp: 10,
    });

    expect(rows[0]._raw.status).toBe('sending');
    expect(rows[0]._raw.matrix_event_id).toBeUndefined();

    await store.markSent('local-1', '$event1', 20);
    expect(rows[0]._raw.status).toBe('sent');
    expect(rows[0]._raw.matrix_event_id).toBe('$event1');
    expect(rows[0]._raw.timestamp).toBe(20);

    await store.markFailed('local-1', 30);
    expect(rows[0]._raw.status).toBe('failed');
    expect(rows[0]._raw.timestamp).toBe(30);
  });
});
