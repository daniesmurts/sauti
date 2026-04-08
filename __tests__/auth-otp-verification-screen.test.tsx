import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {PhoneOTPVerificationScreen as OTPVerificationScreen} from '../src/modules/auth/screens';

function findButtonByLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  return tree.root.find(
    node =>
      node.type === TouchableOpacity && node.props.accessibilityLabel === label,
  );
}

describe('OTPVerificationScreen', () => {
  it('submits otp when valid', () => {
    const onSubmit = jest.fn();
    const onBack = jest.fn();

    const tree = renderer.create(
      <OTPVerificationScreen
        phoneNumber="+2348012345678"
        onBack={onBack}
        onSubmit={onSubmit}
      />,
    );

    const inputs = tree.root.findAllByType(TextInput);
    try {
      act(() => {
        inputs[0].props.onChangeText('123456');
      });

      act(() => {
        findButtonByLabel(tree, 'Verify').props.onPress();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({otpCode: '123456'});
    } finally {
      tree.unmount();
    }
  });

  it('shows local error for invalid otp', () => {
    const tree = renderer.create(
      <OTPVerificationScreen
        phoneNumber="+2348012345678"
        onBack={() => {}}
        onSubmit={() => {}}
      />,
    );

    const inputs = tree.root.findAllByType(TextInput);
    try {
      act(() => {
        inputs[0].props.onChangeText('12');
      });

      act(() => {
        findButtonByLabel(tree, 'Verify').props.onPress();
      });

      const errorNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === 'Enter the OTP code sent to your phone.',
      );

      expect(errorNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('calls onBack when back is pressed', () => {
    const onBack = jest.fn();
    const tree = renderer.create(
      <OTPVerificationScreen
        phoneNumber="+2348012345678"
        onBack={onBack}
        onSubmit={() => {}}
      />,
    );

    try {
      act(() => {
        findButtonByLabel(tree, 'Back').props.onPress();
      });

      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      tree.unmount();
    }
  });
});
