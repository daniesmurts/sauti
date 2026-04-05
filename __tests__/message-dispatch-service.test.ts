import {MessageDispatchService, OutgoingMessageQueue} from '../src/core/messaging';

describe('MessageDispatchService', () => {
  it('enqueues outgoing text messages with generated local ids', async () => {
    const queue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutgoingMessageQueue;

    const statusStore = {
      insertSending: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MessageDispatchService(queue, {
      localIdFactory: () => 'local-fixed-id',
      now: () => 123,
      senderIdProvider: () => '@alice:example.org',
      statusStore,
    });

    const result = await service.sendText('!room:example.org', 'queued body');

    expect(statusStore.insertSending).toHaveBeenCalledWith({
      localId: 'local-fixed-id',
      roomId: '!room:example.org',
      body: 'queued body',
      senderId: '@alice:example.org',
      msgType: 'm.text',
      timestamp: 123,
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      'local-fixed-id',
      '!room:example.org',
      'queued body',
    );
    expect(result).toEqual({localId: 'local-fixed-id'});
  });
});
