import {MatrixMessageSender} from './OutgoingMessageQueue';

export interface MatrixTextMessageClient {
  sendTextMessage(roomId: string, body: string): Promise<{eventId: string}>;
}

export class MatrixMessageSenderAdapter implements MatrixMessageSender {
  constructor(private readonly matrixClient: MatrixTextMessageClient) {}

  async sendMessage(roomId: string, body: string): Promise<{eventId: string}> {
    return this.matrixClient.sendTextMessage(roomId, body);
  }
}
