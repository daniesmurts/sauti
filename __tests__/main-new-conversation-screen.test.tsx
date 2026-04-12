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
      const openAdvancedButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'toggle-advanced-entry',
      );

      await act(async () => {
        openAdvancedButton.props.onPress();
        await Promise.resolve();
      });

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

  it('keeps New Chat open when async start fails', async () => {
    const onStartConversation = jest.fn(async () => false);
    const onBack = jest.fn();

    const tree = renderer.create(
      <NewConversationScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={onStartConversation}
        onBack={onBack}
        startConversationError="Matrix unavailable"
      />,
    );

    try {
      const openAdvancedButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'toggle-advanced-entry',
      );

      await act(async () => {
        openAdvancedButton.props.onPress();
        await Promise.resolve();
      });

      const inputs = tree.root.findAllByType(TextInput);
      const targetInput = inputs[1];

      await act(async () => {
        targetInput.props.onChangeText('@newfriend:example.org');
        await Promise.resolve();
      });

      const startButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'Start Chat',
      );

      await act(async () => {
        await startButton.props.onPress();
        await Promise.resolve();
      });

      const heading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'New Chat',
      );

      expect(onBack).not.toHaveBeenCalled();
      expect(heading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('resolves exact name input to an existing conversation', async () => {
    const onStartConversation = jest.fn();
    const onSelectConversation = jest.fn();
    const onBack = jest.fn();

    const tree = renderer.create(
      <NewConversationScreen
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onStartConversation={onStartConversation}
        onBack={onBack}
      />,
    );

    try {
      const openAdvancedButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'toggle-advanced-entry',
      );

      await act(async () => {
        openAdvancedButton.props.onPress();
        await Promise.resolve();
      });

      const inputs = tree.root.findAllByType(TextInput);
      const targetInput = inputs[1];

      await act(async () => {
        targetInput.props.onChangeText('kwame asante');
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

      expect(onSelectConversation).toHaveBeenCalledWith('!room-1:sauti.app');
      expect(onStartConversation).not.toHaveBeenCalled();
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });

  it('shows disambiguation choices and opens selected match', async () => {
    const onStartConversation = jest.fn();
    const onSelectConversation = jest.fn();
    const onBack = jest.fn();

    const tree = renderer.create(
      <NewConversationScreen
        conversations={[
          ...conversations,
          {
            roomId: '!room-3:sauti.app',
            displayName: 'Amina Diallo',
            lastMessage: 'Ping',
            timestampLabel: 'Now',
            unreadCount: 0,
            isOnline: true,
          },
        ]}
        onSelectConversation={onSelectConversation}
        onStartConversation={onStartConversation}
        onBack={onBack}
      />,
    );

    try {
      const openAdvancedButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'toggle-advanced-entry',
      );

      await act(async () => {
        openAdvancedButton.props.onPress();
        await Promise.resolve();
      });

      const targetInput = tree.root.findAllByType(TextInput)[1];
      await act(async () => {
        targetInput.props.onChangeText('a');
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

      const option = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'ambiguous-match-!room-3:sauti.app',
      );

      await act(async () => {
        option.props.onPress();
        await Promise.resolve();
      });

      expect(onSelectConversation).toHaveBeenCalledWith('!room-3:sauti.app');
      expect(onStartConversation).not.toHaveBeenCalled();
      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });

  it('hydrates initialTarget and shows disambiguation picker', async () => {
    const tree = renderer.create(
      <NewConversationScreen
        conversations={[
          ...conversations,
          {
            roomId: '!room-3:sauti.app',
            displayName: 'Amina Diallo',
            lastMessage: 'Ping',
            timestampLabel: 'Now',
            unreadCount: 0,
            isOnline: true,
          },
        ]}
        initialTarget="a"
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
        onBack={() => {}}
      />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const options = tree.root.findAll(
        node =>
          node.type === TouchableOpacity &&
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('ambiguous-match-'),
      );
      expect(options.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });
});
