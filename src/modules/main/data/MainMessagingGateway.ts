import {Q} from '@nozbe/watermelondb';

import {matrixClient} from '../../../core/matrix';
import {
  getCoreAppRuntime,
  getCoreDatabase,
  getCoreMessagingRuntime,
} from '../../../core/runtime';

import {type ChatMessage} from '../screens/ChatRoomScreen';
import {type ConversationPreview} from '../screens/ConversationListScreen';
import {parseMatrixConversationTarget} from './MatrixConversationTarget';

interface WatermelonMessageRow {
  _raw: {
    local_id?: string;
    matrix_event_id?: string;
    room_id?: string;
    sender_id?: string;
    body?: string;
    status?: 'sending' | 'sent' | 'delivered' | 'failed';
    timestamp?: number;
    is_read?: boolean;
  };
}

interface RuntimeMessageRecord {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
  timestamp: number;
  isRead: boolean;
}

interface RuntimeRoomRecord {
  roomId: string;
  name?: string;
  topic?: string;
  lastEventAt?: number;
}

interface WatermelonRoomRow {
  _raw: {
    id?: string;
    name?: string;
    topic?: string;
    last_event_at?: number;
  };
}

export interface MainMessagingGateway {
  listConversations(): Promise<ConversationPreview[]>;
  listRoomMessages(roomId: string): Promise<ChatMessage[]>;
  sendText(roomId: string, body: string): Promise<void>;
  startConversation(target: string): Promise<{roomId: string}>;
}

function toMessageRecord(row: WatermelonMessageRow): RuntimeMessageRecord | null {
  const roomId = row._raw.room_id;
  const senderId = row._raw.sender_id;
  const body = row._raw.body;
  const timestamp = row._raw.timestamp;

  if (
    typeof roomId !== 'string' ||
    typeof senderId !== 'string' ||
    typeof body !== 'string' ||
    typeof timestamp !== 'number'
  ) {
    return null;
  }

  const idCandidate = row._raw.matrix_event_id ?? row._raw.local_id;

  return {
    id: typeof idCandidate === 'string' ? idCandidate : `${roomId}-${timestamp}`,
    roomId,
    senderId,
    body,
    status: row._raw.status,
    timestamp,
    isRead: row._raw.is_read === true,
  };
}

function formatTimeLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function toDisplayName(roomId: string): string {
  const localPart = roomId
    .replace(/^!/, '')
    .split(':')[0]
    .replace(/[-_]/g, ' ')
    .trim();

  if (localPart.length === 0) {
    return roomId;
  }

  return localPart
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function fetchAllMessages(): Promise<RuntimeMessageRecord[]> {
  const database = getCoreDatabase();
  const rows = (await database
    .get('messages')
    .query(Q.sortBy('timestamp', Q.desc))
    .fetch()) as WatermelonMessageRow[];

  return rows
    .map(toMessageRecord)
    .filter((value): value is RuntimeMessageRecord => value !== null);
}

async function fetchAllRooms(): Promise<RuntimeRoomRecord[]> {
  const database = getCoreDatabase();
  const rows = (await database
    .get('rooms')
    .query(Q.sortBy('last_event_at', Q.desc))
    .fetch()) as WatermelonRoomRow[];

  return rows
    .map(row => {
      const roomId = row._raw.id;
      if (typeof roomId !== 'string' || roomId.length === 0) {
        return null;
      }

      return {
        roomId,
        name: row._raw.name,
        topic: row._raw.topic,
        lastEventAt: row._raw.last_event_at,
      };
    })
    .filter((value): value is RuntimeRoomRecord => value !== null);
}

function getCurrentUserId(): string {
  try {
    return getCoreAppRuntime().getCurrentUserId();
  } catch {
    return 'self';
  }
}

export class RuntimeMainMessagingGateway implements MainMessagingGateway {
  async listConversations(): Promise<ConversationPreview[]> {
    const messages = await fetchAllMessages();
    const rooms = await fetchAllRooms();
    const grouped = new Map<string, RuntimeMessageRecord[]>();
    const roomMap = new Map<string, RuntimeRoomRecord>();

    for (const room of rooms) {
      roomMap.set(room.roomId, room);
    }

    for (const message of messages) {
      const existing = grouped.get(message.roomId) ?? [];
      existing.push(message);
      grouped.set(message.roomId, existing);
    }

    const currentUserId = getCurrentUserId();

    const roomIds = new Set<string>([
      ...grouped.keys(),
      ...roomMap.keys(),
    ]);

    return [...roomIds]
      .map(roomId => {
        const roomMessages = grouped.get(roomId) ?? [];
        const sorted = [...roomMessages].sort((a, b) => b.timestamp - a.timestamp);
        const latest = sorted[0];
        const room = roomMap.get(roomId);

        return {
          roomId,
          displayName: room?.name || toDisplayName(roomId),
          lastMessage: latest?.body ?? room?.topic ?? 'No messages yet.',
          timestampLabel: latest
            ? formatTimeLabel(latest.timestamp)
            : typeof room?.lastEventAt === 'number'
              ? formatTimeLabel(room.lastEventAt)
              : '-',
          unreadCount: roomMessages.filter(
            message => message.senderId !== currentUserId && !message.isRead,
          ).length,
          isOnline: false,
        };
      })
      .sort((a, b) => {
        const aTimestamp =
          grouped.get(a.roomId)?.[0]?.timestamp ?? roomMap.get(a.roomId)?.lastEventAt ?? 0;
        const bTimestamp =
          grouped.get(b.roomId)?.[0]?.timestamp ?? roomMap.get(b.roomId)?.lastEventAt ?? 0;
        return bTimestamp - aTimestamp;
      });
  }

  async listRoomMessages(roomId: string): Promise<ChatMessage[]> {
    const messages = await fetchAllMessages();
    const currentUserId = getCurrentUserId();

    return messages
      .filter(message => message.roomId === roomId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(message => ({
        id: message.id,
        text: message.body,
        direction: message.senderId === currentUserId ? 'outgoing' : 'incoming',
        timestampLabel: formatTimeLabel(message.timestamp),
        status: message.status,
      }));
  }

  async sendText(roomId: string, body: string): Promise<void> {
    const dispatch = getCoreMessagingRuntime().dispatch;
    await dispatch.sendText(roomId, body);
  }

  async startConversation(target: string): Promise<{roomId: string}> {
    const parsed = parseMatrixConversationTarget(target);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    if (parsed.target.kind === 'user_id') {
      return matrixClient.createConversation({
        inviteeUserId: parsed.target.normalized,
      });
    }

    return matrixClient.joinConversation(parsed.target.normalized);
  }
}

export function createRuntimeMainMessagingGateway(): MainMessagingGateway {
  return new RuntimeMainMessagingGateway();
}
