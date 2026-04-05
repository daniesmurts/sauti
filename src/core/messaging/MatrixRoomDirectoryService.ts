import {RoomDirectoryStore} from '../db';
import {MatrixClientEvent} from '../matrix';

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
        .catch(() => {
          // Snapshot hydration is best-effort and should not block startup.
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
        });
        return;
      }

      if (event.type === 'roomMessageReceived') {
        void this.roomStore.touchLastEventAt(event.roomId, event.timestamp);
        return;
      }

      if (event.type === 'roomStateChanged') {
        void this.roomStore.upsertRoomMembership({
          roomId: event.roomId,
          membership: 'join',
          timestamp: event.timestamp,
          roomName: event.roomName,
          topic: event.topic,
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
