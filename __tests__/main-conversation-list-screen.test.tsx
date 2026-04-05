import 'react-native';
import React from 'react';
import {FlatList, TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {
  ConversationListScreen,
  type ConversationPreview,
} from '../src/modules/main/screens';

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

describe('ConversationListScreen', () => {
  it('renders the provided conversations', () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const list = tree.root.findByType(FlatList);
      expect(list.props.data).toHaveLength(2);

      const kwameNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Kwame Asante',
      );
      expect(kwameNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('calls onSelectConversation when a row is pressed', () => {
    const onSelectConversation = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const row = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'conversation-row-!room-1:sauti.app',
      );

      act(() => {
        row.props.onPress();
      });

      expect(onSelectConversation).toHaveBeenCalledTimes(1);
      expect(onSelectConversation).toHaveBeenCalledWith('!room-1:sauti.app');
    } finally {
      tree.unmount();
    }
  });

  it('shows validation message and blocks start for malformed target', async () => {
    const onStartConversation = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={onStartConversation}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('friend-at-example');
        await Promise.resolve();
      });

      const startButton = tree.root.find(
        node =>
          node.type === TouchableOpacity && node.props.accessibilityLabel === 'Start Chat',
      );

      await act(async () => {
        startButton.props.onPress();
        await Promise.resolve();
      });

      const errorNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children ===
            'Use @user:server, #room:server, or !room:server format.',
      );

      expect(errorNodes.length).toBeGreaterThan(0);
      expect(onStartConversation).toHaveBeenCalledTimes(0);
    } finally {
      tree.unmount();
    }
  });

  it('calls onStartConversation with normalized valid target', async () => {
    const onStartConversation = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={onStartConversation}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('  @friend:example.org  ');
        await Promise.resolve();
      });

      const startButton = tree.root.find(
        node =>
          node.type === TouchableOpacity && node.props.accessibilityLabel === 'Start Chat',
      );

      await act(async () => {
        startButton.props.onPress();
        await Promise.resolve();
      });

      expect(onStartConversation).toHaveBeenCalledTimes(1);
      expect(onStartConversation).toHaveBeenCalledWith('@friend:example.org');
    } finally {
      tree.unmount();
    }
  });

  it('shows dynamic hint for @ user id target', async () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('@friend:example.org');
        await Promise.resolve();
      });

      const hintNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children ===
            'Direct chat target detected. Use full Matrix user ID format.',
      );

      expect(hintNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('offers prefix suggestions for bare localpart and lets user apply one', async () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('friend:example.org');
        await Promise.resolve();
      });

      const suggestion = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'start-target-suggestion-@friend:example.org',
      );

      await act(async () => {
        suggestion.props.onPress();
        await Promise.resolve();
      });

      const updatedInput = tree.root.findByType(TextInput);
      expect(updatedInput.props.value).toBe('@friend:example.org');
    } finally {
      tree.unmount();
    }
  });

  it('calls onStartRecentTarget when a recent chip is tapped', async () => {
    const onStartRecentTarget = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        recentTargets={['@friend:example.org']}
        onStartRecentTarget={onStartRecentTarget}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const chip = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'recent-target-chip-@friend:example.org',
      );

      await act(async () => {
        chip.props.onPress();
        await Promise.resolve();
      });

      expect(onStartRecentTarget).toHaveBeenCalledTimes(1);
      expect(onStartRecentTarget).toHaveBeenCalledWith('@friend:example.org');
    } finally {
      tree.unmount();
    }
  });

  it('calls onRemoveRecentTarget when recent remove button is tapped', async () => {
    const onRemoveRecentTarget = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        recentTargets={['@friend:example.org']}
        onRemoveRecentTarget={onRemoveRecentTarget}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const removeButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'remove-recent-target-@friend:example.org',
      );

      await act(async () => {
        removeButton.props.onPress();
        await Promise.resolve();
      });

      expect(onRemoveRecentTarget).toHaveBeenCalledTimes(1);
      expect(onRemoveRecentTarget).toHaveBeenCalledWith('@friend:example.org');
    } finally {
      tree.unmount();
    }
  });

  it('calls onClearRecentTargets when clear action is tapped', async () => {
    const onClearRecentTargets = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        recentTargets={['@friend:example.org']}
        onClearRecentTargets={onClearRecentTargets}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
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

      expect(onClearRecentTargets).toHaveBeenCalledTimes(0);

      await act(async () => {
        clearButton.props.onPress();
        await Promise.resolve();
      });

      expect(onClearRecentTargets).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });

  it('renders proxy and network status banners', () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        proxyStatus="connecting"
        networkState="degraded"
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const proxyNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Proxy connecting',
      );
      expect(proxyNodes.length).toBeGreaterThan(0);

      const offlineNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Offline',
      );
      expect(offlineNodes.length).toBeGreaterThan(0);

      const degradedHintNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children ===
            'Network is degraded. Messages will retry automatically.',
      );
      expect(degradedHintNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('opens composer from FAB and lets user select an existing contact result', async () => {
    const onSelectConversation = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={onSelectConversation}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
        await Promise.resolve();
      });

      const input = tree.root.findByType(TextInput);
      await act(async () => {
        input.props.onChangeText('Kwame');
        await Promise.resolve();
      });

      const result = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel ===
            'search-contact-result-!room-1:sauti.app',
      );

      await act(async () => {
        result.props.onPress();
        await Promise.resolve();
      });

      expect(onSelectConversation).toHaveBeenCalledTimes(1);
      expect(onSelectConversation).toHaveBeenCalledWith('!room-1:sauti.app');
    } finally {
      tree.unmount();
    }
  });

  it('archives a conversation row from swipe actions', async () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const archiveButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'archive-conversation-!room-1:sauti.app',
      );

      await act(async () => {
        archiveButton.props.onPress();
        await Promise.resolve();
      });

      const remainingRows = tree.root.findAll(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'conversation-row-!room-1:sauti.app',
      );
      expect(remainingRows).toHaveLength(0);
    } finally {
      tree.unmount();
    }
  });

  it('toggles muted state from swipe actions', async () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const muteButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'mute-conversation-!room-1:sauti.app',
      );

      await act(async () => {
        muteButton.props.onPress();
        await Promise.resolve();
      });

      const mutedNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Muted',
      );
      expect(mutedNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('expires clear confirmation after timeout and requires reconfirmation', async () => {
    jest.useFakeTimers();
    const onClearRecentTargets = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        recentTargets={['@friend:example.org']}
        onClearRecentTargets={onClearRecentTargets}
        onSelectConversation={() => {}}
        onStartConversation={async () => {}}
      />,
    );

    try {
      const openButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'open-new-conversation',
      );

      await act(async () => {
        openButton.props.onPress();
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
      expect(onClearRecentTargets).toHaveBeenCalledTimes(0);

      const helperVisible = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === 'Tap Confirm again to clear all recent targets.',
      );
      expect(helperVisible.length).toBeGreaterThan(0);

      await act(async () => {
        jest.advanceTimersByTime(4500);
        await Promise.resolve();
      });

      const helperHidden = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === 'Tap Confirm again to clear all recent targets.',
      );
      expect(helperHidden).toHaveLength(0);

      await act(async () => {
        clearButton.props.onPress();
        await Promise.resolve();
      });
      expect(onClearRecentTargets).toHaveBeenCalledTimes(0);

      await act(async () => {
        clearButton.props.onPress();
        await Promise.resolve();
      });
      expect(onClearRecentTargets).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
      jest.useRealTimers();
    }
  });

  it('shows VPN tunnel failure warning card when vpnTunnelFailed is true', () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        proxyStatus="failed"
        vpnTunnelFailed
        onSelectConversation={() => {}}
      />,
    );

    try {
      const warningTitle = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('VPN tunnel failed'),
      );
      expect(warningTitle.length).toBeGreaterThan(0);

      const warningDetail = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('running unprotected') ||
          (node.type === 'Text' &&
            typeof node.props.children === 'string' &&
            node.props.children.includes('without VPN protection')),
      );
      expect(warningDetail.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('does not show VPN warning card when vpnTunnelFailed is false', () => {
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        proxyStatus="failed"
        vpnTunnelFailed={false}
        onSelectConversation={() => {}}
      />,
    );

    try {
      const warningTitle = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('VPN tunnel failed'),
      );
      expect(warningTitle).toHaveLength(0);
    } finally {
      tree.unmount();
    }
  });

  it('calls onRetryProxy when Retry button is pressed in VPN warning card', () => {
    const onRetryProxy = jest.fn();
    const tree = renderer.create(
      <ConversationListScreen
        conversations={conversations}
        proxyStatus="failed"
        vpnTunnelFailed
        onRetryProxy={onRetryProxy}
        onSelectConversation={() => {}}
      />,
    );

    try {
      const retryButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'retry-proxy',
      );
      retryButton.props.onPress();
      expect(onRetryProxy).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });
});
