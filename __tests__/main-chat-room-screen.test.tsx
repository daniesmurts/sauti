import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {ChatRoomScreen} from '../src/modules/main/screens';

describe('ChatRoomScreen', () => {
  it('renders room and messages', () => {
    const tree = renderer.create(
      <ChatRoomScreen
        room={{roomId: '!r:sauti.app', displayName: 'Kwame Asante', isOnline: true}}
        messages={[
          {
            id: 'm1',
            text: 'Hello',
            direction: 'incoming',
            timestampLabel: '08:12',
          },
        ]}
        draftMessage=""
        onBack={() => {}}
        onDraftChange={() => {}}
        onSend={() => {}}
      />,
    );

    try {
      const titleNodes = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Kwame Asante',
      );
      expect(titleNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('propagates draft change and send actions', () => {
    const onDraftChange = jest.fn();
    const onSend = jest.fn();

    const tree = renderer.create(
      <ChatRoomScreen
        room={{roomId: '!r:sauti.app', displayName: 'Kwame Asante', isOnline: true}}
        messages={[]}
        draftMessage="hi"
        onBack={() => {}}
        onDraftChange={onDraftChange}
        onSend={onSend}
      />,
    );

    try {
      const input = tree.root.findByType(TextInput);
      const sendButton = tree.root.find(
        node =>
          node.type === TouchableOpacity && node.props.accessibilityLabel === 'Send',
      );

      act(() => {
        input.props.onChangeText('new message');
      });

      act(() => {
        sendButton.props.onPress();
      });

      expect(onDraftChange).toHaveBeenCalledWith('new message');
      expect(onSend).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });
});
