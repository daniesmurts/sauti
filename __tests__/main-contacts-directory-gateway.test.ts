import {buildChatStartCandidates} from '../src/modules/main/data/ContactsDirectoryGateway';

describe('buildChatStartCandidates', () => {
  it('prioritizes contacts over conversations and de-duplicates by room id', () => {
    const candidates = buildChatStartCandidates({
      contacts: [
        {
          id: '!room-1:sauti.app',
          name: 'Saved Name',
          subtitle: 'Hello',
          isOnline: false,
        },
      ],
      conversations: [
        {
          roomId: '!room-1:sauti.app',
          displayName: 'Conversation Name',
          lastMessage: 'Latest',
          timestampLabel: '07:00',
          unreadCount: 0,
          isOnline: false,
        },
        {
          roomId: '!room-2:sauti.app',
          displayName: 'Ama Boateng',
          lastMessage: 'Ping',
          timestampLabel: '08:00',
          unreadCount: 0,
          isOnline: false,
        },
      ],
    });

    expect(candidates).toEqual([
      {
        roomId: '!room-1:sauti.app',
        displayName: 'Saved Name',
      },
      {
        roomId: '!room-2:sauti.app',
        displayName: 'Ama Boateng',
      },
    ]);
  });
});
