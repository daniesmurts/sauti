import 'react-native';
import React from 'react';
import {TouchableOpacity} from 'react-native';
import renderer from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {AuthMethodChooserScreen} from '../src/modules/auth/screens';

function findButtonByLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  return tree.root.find(
    node =>
      node.type === TouchableOpacity && node.props.accessibilityLabel === label,
  );
}

describe('AuthMethodChooserScreen', () => {
  it('renders email and phone buttons', () => {
    const tree = renderer.create(
      <AuthMethodChooserScreen
        onChooseEmail={jest.fn()}
        onChoosePhone={jest.fn()}
      />,
    );

    try {
      const emailButton = findButtonByLabel(tree, 'Continue with Email');
      const phoneButton = findButtonByLabel(tree, 'Continue with Phone');

      expect(emailButton).toBeTruthy();
      expect(phoneButton).toBeTruthy();
    } finally {
      tree.unmount();
    }
  });

  it('calls onChooseEmail when email button is pressed', () => {
    const onChooseEmail = jest.fn();
    const tree = renderer.create(
      <AuthMethodChooserScreen
        onChooseEmail={onChooseEmail}
        onChoosePhone={jest.fn()}
      />,
    );

    try {
      findButtonByLabel(tree, 'Continue with Email').props.onPress();
      expect(onChooseEmail).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });

  it('calls onChoosePhone when phone button is pressed', () => {
    const onChoosePhone = jest.fn();
    const tree = renderer.create(
      <AuthMethodChooserScreen
        onChooseEmail={jest.fn()}
        onChoosePhone={onChoosePhone}
      />,
    );

    try {
      findButtonByLabel(tree, 'Continue with Phone').props.onPress();
      expect(onChoosePhone).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });
});
