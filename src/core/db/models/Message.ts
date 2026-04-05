export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface MessageRecord {
  localId?: string;
  matrixEventId?: string;
  roomId: string;
  senderId: string;
  body: string;
  msgType: 'm.text' | 'm.image' | 'm.audio' | string;
  status: MessageStatus;
  timestamp: number;
  isRead: boolean;
}
