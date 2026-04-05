import {createWatermelonRoomStore} from '../src/core/db';

describe('WatermelonRoomDirectoryStore', () => {
  it('upserts membership rows, touches activity, and lists rooms', async () => {
    const rows: Array<{
      _raw: Record<string, unknown>;
      update: (updater: () => void) => Promise<void>;
    }> = [];

    const roomsCollection = {
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

    const store = createWatermelonRoomStore({
      get: () => roomsCollection,
    } as unknown as Parameters<typeof createWatermelonRoomStore>[0]);

    await store.upsertRoomMembership({
      roomId: '!kwame:example.org',
      membership: 'join',
      timestamp: 10,
      defaultName: 'Kwame',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]._raw.id).toBe('!kwame:example.org');
    expect(rows[0]._raw.name).toBe('Kwame');

    await store.upsertRoomMembership({
      roomId: '!kwame:example.org',
      membership: 'invite',
      timestamp: 15,
      roomName: 'Kwame Family',
      topic: 'Weekend check-in',
      isDirect: true,
    });

    expect(rows[0]._raw.name).toBe('Kwame Family');
    expect(rows[0]._raw.topic).toBe('Weekend check-in');
    expect(rows[0]._raw.is_direct).toBe(true);
    expect(rows[0]._raw.last_event_at).toBe(15);

    await store.touchLastEventAt('!kwame:example.org', 20);
    expect(rows[0]._raw.last_event_at).toBe(20);

    const listed = await store.listRooms();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual({
      roomId: '!kwame:example.org',
      name: 'Kwame Family',
      topic: 'Weekend check-in',
      isDirect: true,
      lastEventAt: 20,
    });
  });
});
