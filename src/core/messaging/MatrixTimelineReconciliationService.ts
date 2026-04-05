import {MatrixClientEvent} from '../matrix';
import {IncomingMatrixMessage, MessageTimelineStore} from '../db';

export interface MatrixEventSource {
  subscribe(listener: (event: MatrixClientEvent) => void): () => void;
}

export class MatrixTimelineReconciliationService {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly source: MatrixEventSource,
    private readonly timelineStore: MessageTimelineStore,
    private readonly currentUserIdProvider: () => string,
  ) {}

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.source.subscribe(event => {
      if (event.type !== 'roomMessageReceived') {
        return;
      }

      const message: IncomingMatrixMessage = {
        roomId: event.roomId,
        eventId: event.eventId,
        senderId: event.senderId,
        body: event.body,
        msgType: event.msgType,
        timestamp: event.timestamp,
      };

      void this.timelineStore.upsertFromMatrixEvent(
        message,
        this.currentUserIdProvider(),
      );
    });
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
