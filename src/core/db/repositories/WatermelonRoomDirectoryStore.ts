import {Q} from '@nozbe/watermelondb';

export interface RoomDirectoryRecord {
  roomId: string;
  name?: string;
  topic?: string;
  isDirect: boolean;
  lastEventAt?: number;
}

export interface RoomDirectoryStore {
  upsertRoomMembership(input: {
    roomId: string;
    membership: string;
    timestamp: number;
    defaultName?: string;
    roomName?: string;
    topic?: string;
    isDirect?: boolean;
  }): Promise<void>;
  touchLastEventAt(roomId: string, timestamp: number): Promise<void>;
  listRooms(): Promise<RoomDirectoryRecord[]>;
}

interface WatermelonRoomModel {
  _raw: {
    id?: string;
    name?: string;
    topic?: string;
    is_direct?: boolean;
    last_event_at?: number;
  };
  update(updater: () => void): Promise<void>;
}

interface WatermelonRoomsCollectionLike {
  database: {
    write<T>(action: () => Promise<T> | T): Promise<T>;
  };
  create(builder: (record: WatermelonRoomModel) => void): Promise<void>;
  query(...conditions: unknown[]): {
    fetch(): Promise<WatermelonRoomModel[]>;
  };
}

interface WatermelonDatabaseLike {
  get(table: 'rooms'): WatermelonRoomsCollectionLike;
}

function toRoomRecord(model: WatermelonRoomModel): RoomDirectoryRecord | null {
  const roomId = model._raw.id;
  if (typeof roomId !== 'string' || roomId.length === 0) {
    return null;
  }

  return {
    roomId,
    name: model._raw.name,
    topic: model._raw.topic,
    isDirect: model._raw.is_direct === true,
    lastEventAt: model._raw.last_event_at,
  };
}

function deriveName(roomId: string): string {
  const localPart = roomId
    .replace(/^!/, '')
    .split(':')[0]
    .replace(/[-_]/g, ' ')
    .trim();

  if (!localPart) {
    return roomId;
  }

  return localPart
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export class WatermelonRoomDirectoryStore implements RoomDirectoryStore {
  constructor(private readonly rooms: WatermelonRoomsCollectionLike) {}

  async upsertRoomMembership(input: {
    roomId: string;
    membership: string;
    timestamp: number;
    defaultName?: string;
    roomName?: string;
    topic?: string;
    isDirect?: boolean;
  }): Promise<void> {
    const existing = await this.findByRoomId(input.roomId);
    const resolvedName = input.roomName ?? input.defaultName ?? deriveName(input.roomId);
    const membership = input.membership.toLowerCase();
    const resolvedDirect = input.isDirect ?? membership === 'invite';

    if (existing) {
      await existing.update(() => {
        if (typeof resolvedName === 'string' && resolvedName.trim().length > 0) {
          existing._raw.name = resolvedName;
        } else if (!existing._raw.name) {
          existing._raw.name = deriveName(input.roomId);
        }

        if (typeof input.topic === 'string') {
          existing._raw.topic = input.topic;
        }

        if (
          typeof existing._raw.last_event_at !== 'number' ||
          input.timestamp > existing._raw.last_event_at
        ) {
          existing._raw.last_event_at = input.timestamp;
        }

        existing._raw.is_direct = resolvedDirect;
      });
      return;
    }

    await this.rooms.database.write(async () => {
      await this.rooms.create(record => {
        record._raw.id = input.roomId;
        record._raw.name = resolvedName;
        record._raw.topic = input.topic;
        record._raw.is_direct = resolvedDirect;
        record._raw.last_event_at = input.timestamp;
      });
    });
  }

  async touchLastEventAt(roomId: string, timestamp: number): Promise<void> {
    const existing = await this.findByRoomId(roomId);

    if (existing) {
      await existing.update(() => {
        if (
          typeof existing._raw.last_event_at !== 'number' ||
          timestamp > existing._raw.last_event_at
        ) {
          existing._raw.last_event_at = timestamp;
        }
      });
      return;
    }

    await this.upsertRoomMembership({
      roomId,
      membership: 'join',
      timestamp,
    });
  }

  async listRooms(): Promise<RoomDirectoryRecord[]> {
    const rows = await this.rooms
      .query(Q.sortBy('last_event_at', Q.desc))
      .fetch();

    return rows
      .map(toRoomRecord)
      .filter((value): value is RoomDirectoryRecord => value !== null);
  }

  private async findByRoomId(roomId: string): Promise<WatermelonRoomModel | null> {
    const rows = await this.rooms.query(Q.where('id', roomId)).fetch();
    return rows[0] ?? null;
  }
}

export function createWatermelonRoomDirectoryStore(
  database: WatermelonDatabaseLike,
): WatermelonRoomDirectoryStore {
  return new WatermelonRoomDirectoryStore(database.get('rooms'));
}
