import {
  buildChatStartCandidates,
  buildContactSearchText,
} from '../src/modules/main/data/ContactsDirectoryGateway';
import {
  inferContactIdentityMetadata,
  mergeContactRecord,
} from '../src/core/db';

describe('buildChatStartCandidates', () => {
  it('prioritizes contacts over conversations and de-duplicates by room id', () => {
    const candidates = buildChatStartCandidates({
      contacts: [
        {
          id: '!room-1:sauti.app',
          name: 'Saved Name',
          subtitle: 'Hello',
          source: 'manual',
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

  it('builds contact search text from name and identifiers', () => {
    expect(
      buildContactSearchText({
        id: '!room-1:sauti.app',
        name: 'Kwame Asante',
        subtitle: 'No messages yet',
        matrixUserId: '@kwame:matrix.sauti.ru',
        phoneNumber: '+2335550101',
        source: 'manual',
        isOnline: false,
      }),
    ).toContain('@kwame:matrix.sauti.ru');
  });
});

describe('contact metadata merge', () => {
  it('infers Matrix IDs and phone numbers from display values', () => {
    expect(
      inferContactIdentityMetadata({
        displayName: '@kwame:matrix.sauti.ru',
      }),
    ).toEqual({
      displayName: '@kwame:matrix.sauti.ru',
      matrixUserId: '@kwame:matrix.sauti.ru',
      phoneNumber: undefined,
    });

    expect(
      inferContactIdentityMetadata({
        displayName: '+233 555 0101',
      }),
    ).toEqual({
      displayName: '+233 555 0101',
      matrixUserId: undefined,
      phoneNumber: '+2335550101',
    });
  });

  it('preserves stronger manual metadata during conversation sync updates', () => {
    expect(
      mergeContactRecord(
        {
          contactId: '!room-1:sauti.app',
          displayName: 'Kwame Asante',
          matrixUserId: '@kwame:matrix.sauti.ru',
          phoneNumber: '+2335550101',
          source: 'manual',
          lastMessage: 'Old message',
          isOnline: false,
          updatedAt: 10,
        },
        {
          contactId: '!room-1:sauti.app',
          displayName: 'K. Asante',
          source: 'conversation_sync',
          lastMessage: 'New message',
          isOnline: true,
          updatedAt: 20,
        },
      ),
    ).toEqual({
      contactId: '!room-1:sauti.app',
      displayName: 'Kwame Asante',
      matrixUserId: '@kwame:matrix.sauti.ru',
      phoneNumber: '+2335550101',
      source: 'manual',
      lastMessage: 'New message',
      isOnline: true,
      updatedAt: 20,
    });
  });
});
