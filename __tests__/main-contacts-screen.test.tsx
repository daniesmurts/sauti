import 'react-native';
import React from 'react';
import {Text, TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {ContactsScreen} from '../src/modules/main/screens/ContactsScreen';

function createMockGateway() {
  return {
    async listConversations() {
      return [
        {
          roomId: '!room-kwame:sauti.app',
          displayName: 'Kwame Asante',
          lastMessage: 'Have you reached campus safely?',
          timestampLabel: '07:45',
          unreadCount: 1,
          isOnline: false,
        },
        {
          roomId: '!room-ama:sauti.app',
          displayName: 'Ama Boateng',
          lastMessage: 'Call mum when you can.',
          timestampLabel: '07:10',
          unreadCount: 0,
          isOnline: false,
        },
      ];
    },
  };
}

function createMockContactsGateway() {
  const state = {
    contacts: [] as Array<{
      id: string;
      name: string;
      subtitle: string;
      isOnline: boolean;
    }>,
  };

  return {
    async syncFromConversations(
      conversations: Array<{
        roomId: string;
        displayName: string;
        lastMessage: string;
        isOnline: boolean;
      }>,
    ) {
      state.contacts = conversations.map(conversation => ({
        id: conversation.roomId,
        name: conversation.displayName,
        subtitle: conversation.lastMessage || 'No messages yet',
        isOnline: conversation.isOnline,
      }));
    },
    async listContacts() {
      return state.contacts;
    },
  };
}

describe('ContactsScreen', () => {
  it('filters contacts and starts chat with selected contact name', async () => {
    const onStartChat = jest.fn();

    const tree = renderer.create(
      <ContactsScreen
        gateway={createMockGateway()}
        contactsGateway={createMockContactsGateway()}
        refreshIntervalMs={0}
        onStartChat={onStartChat}
      />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const searchInput = tree.root.find(
        node => node.type === TextInput && node.props.accessibilityLabel === 'contacts-search',
      );

      await act(async () => {
        searchInput.props.onChangeText('Kwame');
        await Promise.resolve();
      });

      const contactButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-contact-!room-kwame:sauti.app',
      );

      await act(async () => {
        contactButton.props.onPress();
        await Promise.resolve();
      });

      expect(onStartChat).toHaveBeenCalledWith('Kwame Asante');
    } finally {
      tree.unmount();
    }
  });

  it('shows empty state after unmatched search', async () => {
    const tree = renderer.create(
      <ContactsScreen
        gateway={createMockGateway()}
        contactsGateway={createMockContactsGateway()}
        refreshIntervalMs={0}
      />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const searchInput = tree.root.find(
        node => node.type === TextInput && node.props.accessibilityLabel === 'contacts-search',
      );

      await act(async () => {
        searchInput.props.onChangeText('No Such Person');
        await Promise.resolve();
      });

      const emptyStateTitle = tree.root.findAll(
        node => node.type === Text && node.props.children === 'No contacts found',
      );

      expect(emptyStateTitle.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });
});
