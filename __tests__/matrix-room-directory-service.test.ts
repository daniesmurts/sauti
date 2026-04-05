import {MatrixRoomDirectoryService} from '../src/core/messaging';

describe('MatrixRoomDirectoryService', () => {
  it('upserts room membership and touches last event timestamps', async () => {
    const upsertRoomMembership = jest.fn().mockResolvedValue(undefined);
    const touchLastEventAt = jest.fn().mockResolvedValue(undefined);

    let handler: ((event: {
      type: string;
      roomId?: string;
      membership?: string;
      timestamp?: number;
    }) => void) | null = null;

    const source = {
      subscribe: jest.fn().mockImplementation(listener => {
        handler = listener;
        return () => {
          handler = null;
        };
      }),
    };

    const service = new MatrixRoomDirectoryService(
      source,
      {
        upsertRoomMembership,
        touchLastEventAt,
        listRooms: jest.fn().mockResolvedValue([]),
      },
      () => 500,
    );

    service.start();

    handler?.({
      type: 'roomMembershipChanged',
      roomId: '!room:example.org',
      membership: 'join',
      roomName: 'Family Group',
      topic: 'Campus updates',
      isDirect: false,
    });

    handler?.({
      type: 'roomMessageReceived',
      roomId: '!room:example.org',
      timestamp: 123,
    });

    await Promise.resolve();

    expect(upsertRoomMembership).toHaveBeenCalledTimes(1);
    expect(upsertRoomMembership).toHaveBeenCalledWith({
      roomId: '!room:example.org',
      membership: 'join',
      timestamp: 500,
      roomName: 'Family Group',
      topic: 'Campus updates',
      isDirect: false,
    });

    expect(touchLastEventAt).toHaveBeenCalledTimes(1);
    expect(touchLastEventAt).toHaveBeenCalledWith('!room:example.org', 123);

    service.stop();
    expect(handler).toBeNull();
  });

  it('upserts room metadata when room state changes arrive', async () => {
    const upsertRoomMembership = jest.fn().mockResolvedValue(undefined);

    let handler: ((event: {
      type: string;
      roomId?: string;
      roomName?: string;
      topic?: string;
      timestamp?: number;
    }) => void) | null = null;

    const source = {
      subscribe: jest.fn().mockImplementation(listener => {
        handler = listener;
        return () => {
          handler = null;
        };
      }),
    };

    const service = new MatrixRoomDirectoryService(
      source,
      {
        upsertRoomMembership,
        touchLastEventAt: jest.fn().mockResolvedValue(undefined),
        listRooms: jest.fn().mockResolvedValue([]),
      },
      () => 500,
    );

    service.start();

    handler?.({
      type: 'roomStateChanged',
      roomId: '!room:example.org',
      roomName: 'Renamed Room',
      topic: 'New topic',
      timestamp: 321,
    });

    await Promise.resolve();

    expect(upsertRoomMembership).toHaveBeenCalledWith({
      roomId: '!room:example.org',
      membership: 'join',
      timestamp: 321,
      roomName: 'Renamed Room',
      topic: 'New topic',
    });

    service.stop();
  });

  it('hydrates room snapshots at startup when snapshot provider is available', async () => {
    const upsertRoomMembership = jest.fn().mockResolvedValue(undefined);

    const source = {
      subscribe: jest.fn().mockImplementation(() => () => undefined),
      listRoomSnapshots: jest.fn().mockResolvedValue([
        {
          roomId: '!family:example.org',
          roomName: 'Family Group',
          topic: 'Prayer updates',
          isDirect: false,
          lastEventAt: 777,
        },
      ]),
    };

    const service = new MatrixRoomDirectoryService(
      source,
      {
        upsertRoomMembership,
        touchLastEventAt: jest.fn().mockResolvedValue(undefined),
        listRooms: jest.fn().mockResolvedValue([]),
      },
      () => 500,
    );

    service.start();
    await Promise.resolve();

    expect(source.listRoomSnapshots).toHaveBeenCalledTimes(1);
    expect(upsertRoomMembership).toHaveBeenCalledWith({
      roomId: '!family:example.org',
      membership: 'join',
      timestamp: 777,
      roomName: 'Family Group',
      topic: 'Prayer updates',
      isDirect: false,
    });

    service.stop();
  });
});
