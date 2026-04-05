import {MatrixTimelineReconciliationService} from '../src/core/messaging';

describe('MatrixTimelineReconciliationService', () => {
  it('subscribes to matrix roomMessageReceived events and upserts timeline rows', async () => {
    const upsertFromMatrixEvent = jest.fn().mockResolvedValue('inserted');

    let handler: ((event: {
      type: string;
      roomId?: string;
      eventId?: string;
      senderId?: string;
      body?: string;
      msgType?: string;
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

    const service = new MatrixTimelineReconciliationService(
      source,
      {
        upsertFromMatrixEvent,
      },
      () => '@alice:example.org',
    );

    service.start();

    handler?.({
      type: 'connectionStateChanged',
    });
    handler?.({
      type: 'roomMessageReceived',
      roomId: '!room:example.org',
      eventId: '$event-1',
      senderId: '@bob:example.org',
      body: 'hello',
      msgType: 'm.text',
      timestamp: 100,
    });

    await Promise.resolve();

    expect(upsertFromMatrixEvent).toHaveBeenCalledTimes(1);
    expect(upsertFromMatrixEvent).toHaveBeenCalledWith(
      {
        roomId: '!room:example.org',
        eventId: '$event-1',
        senderId: '@bob:example.org',
        body: 'hello',
        msgType: 'm.text',
        timestamp: 100,
      },
      '@alice:example.org',
    );

    service.stop();
    expect(handler).toBeNull();
  });
});
