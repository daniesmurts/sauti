import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it} from '@jest/globals';

import {MainFlowScreen} from '../src/modules/main/screens';
import {
  MainMessagingGateway,
  type RecentConversationTargetsStore,
} from '../src/modules/main';

function createMockGateway(): MainMessagingGateway {
  const state = {
    conversations: [
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
    ],
    roomMessages: {
      '!room-kwame:sauti.app': [
        {
          id: 'kwame-1',
          text: 'Have you reached campus safely?',
          direction: 'incoming' as const,
          timestampLabel: '07:45',
        },
      ],
      '!room-ama:sauti.app': [
        {
          id: 'ama-1',
          text: 'Call mum when you can.',
          direction: 'incoming' as const,
          timestampLabel: '07:10',
        },
      ],
    } as Record<string, Array<{id: string; text: string; direction: 'incoming' | 'outgoing'; timestampLabel: string; status?: 'sending' | 'sent' | 'delivered' | 'read'}>>,
  };

  return {
    async listConversations() {
      return state.conversations;
    },
    async listRoomMessages(roomId: string) {
      return state.roomMessages[roomId] ?? [];
    },
    async sendText(roomId: string, body: string) {
      const updatedMessage = {
        id: `${roomId}-new`,
        text: body,
        direction: 'outgoing' as const,
        timestampLabel: '08:01',
        status: 'sent' as const,
      };
      state.roomMessages[roomId] = [...(state.roomMessages[roomId] ?? []), updatedMessage];
      state.conversations = state.conversations.map(conversation =>
        conversation.roomId === roomId
          ? {
              ...conversation,
              lastMessage: body,
              timestampLabel: '08:01',
            }
          : conversation,
      );
    },
    async startConversation(target: string) {
      const roomId =
        target.startsWith('@')
          ? `!dm-${target.replace(/[!@:#.]/g, '-')}:sauti.app`
          : target.startsWith('!')
            ? target
            : '!joined-room:sauti.app';

      const displayName = target.startsWith('@') ? target : 'Joined Room';

      state.conversations = [
        {
          roomId,
          displayName,
          lastMessage: 'No messages yet.',
          timestampLabel: '08:10',
          unreadCount: 0,
          isOnline: false,
        },
        ...state.conversations,
      ];
      state.roomMessages[roomId] = [];

      return {roomId};
    },
  };
}

describe('MainFlowScreen', () => {
  it('opens a conversation from list and returns back', async () => {
    const tree = renderer.create(
      <MainFlowScreen gateway={createMockGateway()} refreshIntervalMs={0} />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const row = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'conversation-row-!room-kwame:sauti.app',
      );

      await act(async () => {
        row.props.onPress();
        await Promise.resolve();
      });

      const chatTitle = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Kwame Asante',
      );
      expect(chatTitle.length).toBeGreaterThan(0);

      const backButton = tree.root.find(
        node =>
          node.type === TouchableOpacity && node.props.accessibilityLabel === 'Back',
      );

      await act(async () => {
        backButton.props.onPress();
        await Promise.resolve();
      });

      const chatsHeading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Chats',
      );
      expect(chatsHeading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('sends a message in active room', async () => {
    const tree = renderer.create(
      <MainFlowScreen gateway={createMockGateway()} refreshIntervalMs={0} />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const row = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'conversation-row-!room-kwame:sauti.app',
      );

      await act(async () => {
        row.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);
      const sendButton = tree.root.find(
        node =>
          node.type === TouchableOpacity && node.props.accessibilityLabel === 'Send',
      );

      await act(async () => {
        input.props.onChangeText('New secure ping');
        await Promise.resolve();
      });

      await act(async () => {
        sendButton.props.onPress();
        await Promise.resolve();
      });

      const messageNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'New secure ping',
      );

      expect(messageNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('starts a new direct chat from matrix user id input', async () => {
    const tree = renderer.create(
      <MainFlowScreen gateway={createMockGateway()} refreshIntervalMs={0} />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const input = tree.root
        .findAllByType(TextInput)
        .find(node => node.props.accessibilityLabel === 'Matrix ID or Room Alias');
      expect(input).toBeDefined();

      await act(async () => {
        input!.props.onChangeText('@newfriend:example.org');
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

      const roomTitle = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === '@newfriend:example.org',
      );
      expect(roomTitle.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('clears all recent targets from the list action', async () => {
    const storeState = {
      targets: ['@friend:example.org', '#room:example.org'],
    };
    const mockRecentStore: RecentConversationTargetsStore = {
      async listTargets() {
        return [...storeState.targets];
      },
      async addTarget(target: string) {
        storeState.targets = [target, ...storeState.targets.filter(item => item !== target)];
      },
      async removeTarget(target: string) {
        storeState.targets = storeState.targets.filter(item => item !== target);
      },
      async clearTargets() {
        storeState.targets = [];
      },
    };

    const tree = renderer.create(
      <MainFlowScreen
        gateway={createMockGateway()}
        recentTargetsStore={mockRecentStore}
        refreshIntervalMs={0}
      />,
    );

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const clearButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'clear-recent-targets',
      );

      await act(async () => {
        clearButton.props.onPress();
        await Promise.resolve();
      });

      const chipsAfterFirstTap = tree.root.findAll(
        node =>
          node.type === TouchableOpacity &&
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('recent-target-chip-'),
      );
      expect(chipsAfterFirstTap).toHaveLength(2);

      await act(async () => {
        clearButton.props.onPress();
        await Promise.resolve();
      });

      const recentChips = tree.root.findAll(
        node =>
          node.type === TouchableOpacity &&
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('recent-target-chip-'),
      );

      expect(recentChips).toHaveLength(0);
    } finally {
      tree.unmount();
    }
  });
});
