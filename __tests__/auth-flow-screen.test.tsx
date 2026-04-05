import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {AuthFlowScreen} from '../src/modules/auth/screens';
import {AuthController} from '../src/modules/auth';
import {AuthStoreSnapshot} from '../src/modules/auth/store';

function findButtonByLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  return tree.root.find(
    node =>
      node.type === TouchableOpacity && node.props.accessibilityLabel === label,
  );
}

function createMockController(initialStatus: AuthStoreSnapshot['status'] = 'idle'): AuthController {
  let snapshot: AuthStoreSnapshot = {status: initialStatus};
  const listeners = new Set<(value: AuthStoreSnapshot) => void>();

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async registerAndBootstrap(request) {
      snapshot = {
        status: 'ready',
        userId: '@new:user.test',
      };
      listeners.forEach(listener => listener(snapshot));
      void request;
    },
    async resumeFromStoredSession() {},
    reset() {
      snapshot = {status: 'idle'};
      listeners.forEach(listener => listener(snapshot));
    },
  };
}

describe('AuthFlowScreen', () => {
  it('moves from phone step to otp step', async () => {
    const controller = createMockController();
    const tree = renderer.create(<AuthFlowScreen controller={controller} />);

    try {
      const phoneInput = tree.root.findByType(TextInput);
      const continueButton = findButtonByLabel(tree, 'Continue');

      await act(async () => {
        phoneInput.props.onChangeText('+234 801 234 5678');
        await Promise.resolve();
      });

      await act(async () => {
        continueButton.props.onPress();
        await Promise.resolve();
      });

      const verifyHeading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Verify OTP',
      );

      expect(verifyHeading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('renders success state when auth snapshot is ready', () => {
    const controller = createMockController('ready');
    const tree = renderer.create(<AuthFlowScreen controller={controller} />);

    try {
      const successHeading = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === 'Authentication Complete',
      );

      expect(successHeading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });
});
