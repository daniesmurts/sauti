export type OutgoingMessageStatus = 'pending' | 'sent' | 'failed';

export interface OutgoingMessageRecord {
  localId: string;
  roomId: string;
  body: string;
  status: OutgoingMessageStatus;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  matrixEventId?: string;
  lastError?: string;
}
