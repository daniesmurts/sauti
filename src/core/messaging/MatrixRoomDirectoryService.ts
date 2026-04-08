import {RoomDirectoryStore} from '../db';
import {MatrixClientEvent} from '../matrix';
import {logger} from '../../utils/logger';

export interface MatrixRoomDirectoryEventSource {
  subscribe(listener: (event: MatrixClientEvent) => void): () => void;
  listRoomSnapshots?: () => Promise<
    Array<{
      roomId: string;
      roomName?: string;
      topic?: string;
      isDirect?: boolean;
      lastEventAt?: number;
    }>
  >;
}

export class MatrixRoomDirectoryService {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly source: MatrixRoomDirectoryEventSource,
    private readonly roomStore: RoomDirectoryStore,
    private readonly now: () => number = Date.now,
  ) {}

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    if (typeof this.source.listRoomSnapshots === 'function') {
      void this.source
        .listRoomSnapshots()
        .then(snapshots =>
          Promise.all(
            snapshots.map(snapshot =>
              this.roomStore.upsertRoomMembership({
                roomId: snapshot.roomId,
                membership: 'join',
                timestamp: snapshot.lastEventAt ?? this.now(),
                roomName: snapshot.roomName,
                topic: snapshot.topic,
                isDirect: snapshot.isDirect,
              }),
            ),
          ),
        )
        .catch((error: unknown) => {
          // Snapshot hydration is best-effort and should not block startup.
          logger.warn('Room directory snapshot hydration failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }

    this.unsubscribe = this.source.subscribe(event => {
      if (event.type === 'roomMembershipChanged') {
        void this.roomStore.upsertRoomMembership({
          roomId: event.roomId,
          membership: event.membership,
          timestamp: this.now(),
          roomName: event.roomName,
          topic: event.topic,
          isDirect: event.isDirect,
        }).catch((error: unknown) => {
          logger.warn('Failed to persist room membership change', {
            roomId: event.roomId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        return;
      }

      if (event.type === 'roomMessageReceived') {
        void this.roomStore.touchLastEventAt(event.roomId, event.timestamp).catch((error: unknown) => {
          logger.warn('Failed to update room lastEventAt', {
            roomId: event.roomId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
        return;
      }

      if (event.type === 'roomStateChanged') {
        void this.roomStore.upsertRoomMembership({
          roomId: event.roomId,
          membership: 'join',
          timestamp: event.timestamp,
          roomName: event.roomName,
          topic: event.topic,
        }).catch((error: unknown) => {
          logger.warn('Failed to persist room state change', {
            roomId: event.roomId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    });
  }

  stop(): void {
    if (!this.unsubscribe) {
      return;
    }

    this.unsubscribe();
    this.unsubscribe = null;
  }
}
