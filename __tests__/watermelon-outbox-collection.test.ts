import {createWatermelonOutgoingMessageCollection} from '../src/core/db';

describe('createWatermelonOutgoingMessageCollection', () => {
  it('creates, finds, lists, and updates outbox records through Watermelon model proxies', async () => {
    const createdModels: Array<{
      _raw: Record<string, unknown>;
      update: (updater: () => void) => Promise<void>;
    }> = [];

    const query = jest
      .fn()
      .mockReturnValueOnce({
        fetch: async () => [createdModels[0]],
      })
      .mockReturnValueOnce({
        fetch: async () => [createdModels[0]],
      });

    const collection = {
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
        createdModels.push(model);
      },
      query,
    };

    const database = {
      get: () => collection,
    };

    const outbox = createWatermelonOutgoingMessageCollection(
      database as unknown as Parameters<typeof createWatermelonOutgoingMessageCollection>[0],
    );

    await outbox.create(record => {
      record.local_id = 'local-1';
      record.room_id = '!room:example.org';
      record.body = 'hello';
      record.status = 'pending';
      record.attempts = 0;
      record.next_attempt_at = 100;
      record.created_at = 100;
      record.updated_at = 100;
    });

    const found = await outbox.findByLocalId('local-1');
    expect(found?.local_id).toBe('local-1');

    await found?.update(() => {
      if (!found) {
        return;
      }
      found.status = 'sent';
      found.matrix_event_id = '$event-1';
    });

    const listed = await outbox.listByStatus('pending');
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe('sent');
    expect(listed[0].matrix_event_id).toBe('$event-1');
  });
});
