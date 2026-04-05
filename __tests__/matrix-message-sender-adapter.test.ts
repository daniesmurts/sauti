import {MatrixMessageSenderAdapter} from '../src/core/messaging';

describe('MatrixMessageSenderAdapter', () => {
  it('forwards send requests to matrix client sendTextMessage', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({eventId: '$event-1'});
    const adapter = new MatrixMessageSenderAdapter({sendTextMessage});

    const sent = await adapter.sendMessage('!room:example.org', 'hello');

    expect(sendTextMessage).toHaveBeenCalledWith('!room:example.org', 'hello');
    expect(sent).toEqual({eventId: '$event-1'});
  });
});
