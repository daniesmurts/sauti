import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';

import {
  NewConversationScreen,
  type ConversationPreview,
} from '../src/modules/main/screens/NewConversationScreen';

const conversations: ConversationPreview[] = [
  {
    roomId: '!room-1:sauti.app',
    displayName: 'Kwame Asante',
    lastMessage: 'Hello there',
    timestampLabel: '08:10',
    unreadCount: 2,
    isOnline: true,
  },
  {
    roomId: '!room-2:sauti.app',
    displayName: 'Ama Boateng',
    lastMessage: 'See you soon',
    timestampLabel: 'Yesterday',
    unreadCount: 0,
    isOnline: false,
  },
];

describe('NewConversationScreen', () => {
  it('filters contacts by search query and selects contact', async () => {
    const onSelectConversation = jest.fn();
    const onBack = jest.fn();

    const tree = renderer.create(
      <NewConversationScreen
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onBack={onBack}
      />,
    );

    try {
      const searchInput = tree.root.findAllByType(TextInput)[0];
      await act(async () => {
        searchInput.props.onChangeText('Kwame');
        await Promise.resolve();
      });

      const result = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'contact-!room-1:sauti.app',
      );

      await act(async () => {
        result.props.onPress();
        await Promise.resolve();
      });

      expect(onSelectConversation).toHaveBeenCalledWith('!room-1:sauti.app');
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });

  it('starts a conversation with normalized target and closes screen', async () => {
    const onStartConversation = jest.fn();
    const onBack = jest.fn();

    const tree = renderer.create(
      <NewConversationScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={onStartConversation}
        onBack={onBack}
      />,
    );

    try {
      const inputs = tree.root.findAllByType(TextInput);
      const targetInput = inputs[1];

      await act(async () => {
        targetInput.props.onChangeText('  @newfriend:example.org  ');
        await Promise.resolve();
      });

      const startButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'Start Chat',
      );

      await act(async () => {
        startButton.props.onPress();
        await Promise.resolve();
      });

      expect(onStartConversation).toHaveBeenCalledWith('@newfriend:example.org');
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });
});
