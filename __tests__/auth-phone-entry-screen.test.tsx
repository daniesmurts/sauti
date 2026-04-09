import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {PhoneEntryScreen} from '../src/modules/auth/screens';

function findButtonByLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  return tree.root.find(
    node =>
      node.type === TouchableOpacity && node.props.accessibilityLabel === label,
  );
}

describe('PhoneEntryScreen', () => {
  it('calls onContinue with normalized phone when input is valid', () => {
    const onContinue = jest.fn();
    const tree = renderer.create(<PhoneEntryScreen onContinue={onContinue} />);

    const input = tree.root.findByType(TextInput);

    try {
      act(() => {
        input.props.onChangeText('+234 801-234-5678');
      });

      act(() => {
        findButtonByLabel(tree, 'Send Code').props.onPress();
      });

      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(onContinue).toHaveBeenCalledWith('+2348012345678');
    } finally {
      tree.unmount();
    }
  });

  it('shows validation error and does not continue for invalid number', () => {
    const onContinue = jest.fn();
    const tree = renderer.create(<PhoneEntryScreen onContinue={onContinue} />);

    const input = tree.root.findByType(TextInput);

    try {
      act(() => {
        input.props.onChangeText('abc');
      });

      act(() => {
        findButtonByLabel(tree, 'Send Code').props.onPress();
      });

      const errorNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children ===
            'Enter a valid phone number in international format.',
      );

      expect(errorNodes.length).toBeGreaterThan(0);
      expect(onContinue).toHaveBeenCalledTimes(0);
    } finally {
      tree.unmount();
    }
  });
});
