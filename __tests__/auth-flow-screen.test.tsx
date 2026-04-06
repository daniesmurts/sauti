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

function createMockOtpService() {
  return {
    requestOtp: jest.fn(async () => ({requestId: 'otp-request-1'})),
    verifyOtp: jest.fn(async () => ({verified: true})),
  };
}

describe('AuthFlowScreen', () => {
  it('moves from phone step to otp step', async () => {
    const controller = createMockController();
    const otpService = createMockOtpService();
    const tree = renderer.create(
      <AuthFlowScreen controller={controller} otpService={otpService} />,
    );

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

      expect(otpService.requestOtp).toHaveBeenCalledWith({
        phoneNumber: '+2348012345678',
      });

      const verifyHeading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Verify OTP',
      );

      expect(verifyHeading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('moves from otp step to profile setup step', async () => {
    const controller = createMockController();
    const otpService = createMockOtpService();
    const tree = renderer.create(
      <AuthFlowScreen controller={controller} otpService={otpService} />,
    );

    try {
      // Phone step
      const phoneInput = tree.root.findByType(TextInput);
      await act(async () => {
        phoneInput.props.onChangeText('+234 801 234 5678');
        await Promise.resolve();
      });
      await act(async () => {
        findButtonByLabel(tree, 'Continue').props.onPress();
        await Promise.resolve();
      });

      // OTP step — enter 6-digit code
      const otpInput = tree.root.findByType(TextInput);
      await act(async () => {
        otpInput.props.onChangeText('123456');
        await Promise.resolve();
      });
      await act(async () => {
        findButtonByLabel(tree, 'Verify').props.onPress();
        await Promise.resolve();
      });

      expect(otpService.verifyOtp).toHaveBeenCalledWith({
        phoneNumber: '+2348012345678',
        otpCode: '123456',
        requestId: 'otp-request-1',
      });

      const profileHeading = tree.root.findAll(
        node =>
          node.type === 'Text' && node.props.children === 'Set Up Your Profile',
      );
      expect(profileHeading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('completes registration after profile setup', async () => {
    const registeredRequests: unknown[] = [];
    const controller = createMockController();
    const otpService = createMockOtpService();
    const origRegister = controller.registerAndBootstrap.bind(controller);
    controller.registerAndBootstrap = async req => {
      registeredRequests.push(req);
      return origRegister(req);
    };

    const tree = renderer.create(
      <AuthFlowScreen controller={controller} otpService={otpService} />,
    );

    try {
      // Phone step
      const phoneInput = tree.root.findByType(TextInput);
      await act(async () => {
        phoneInput.props.onChangeText('+234 801 234 5678');
        await Promise.resolve();
      });
      await act(async () => {
        findButtonByLabel(tree, 'Continue').props.onPress();
        await Promise.resolve();
      });

      // OTP step
      const otpInput = tree.root.findByType(TextInput);
      await act(async () => {
        otpInput.props.onChangeText('654321');
        await Promise.resolve();
      });
      await act(async () => {
        findButtonByLabel(tree, 'Verify').props.onPress();
        await Promise.resolve();
      });

      // Profile setup step
      const nameInput = tree.root.findByType(TextInput);
      await act(async () => {
        nameInput.props.onChangeText('Kwame Asante');
        await Promise.resolve();
      });
      await act(async () => {
        findButtonByLabel(tree, 'profile-setup-continue').props.onPress();
        await Promise.resolve();
      });

      expect(registeredRequests).toHaveLength(1);
      expect((registeredRequests[0] as {displayName: string}).displayName).toBe(
        'Kwame Asante',
      );

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

  it('stays on phone entry and shows request error when otp request fails', async () => {
    const controller = createMockController();
    const otpService = {
      requestOtp: jest.fn(async () => {
        throw new Error('SMS provider unavailable');
      }),
      verifyOtp: jest.fn(async () => ({verified: true})),
    };
    const tree = renderer.create(
      <AuthFlowScreen controller={controller} otpService={otpService} />,
    );

    try {
      const phoneInput = tree.root.findByType(TextInput);
      await act(async () => {
        phoneInput.props.onChangeText('+234 801 234 5678');
        await Promise.resolve();
      });

      await act(async () => {
        findButtonByLabel(tree, 'Continue').props.onPress();
        await Promise.resolve();
      });

      const signInHeading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Sign in to Sauti',
      );
      const errorNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('SMS provider unavailable'),
      );

      expect(signInHeading.length).toBeGreaterThan(0);
      expect(errorNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('stays on otp step and shows verify error when otp verification fails', async () => {
    const controller = createMockController();
    const otpService = {
      requestOtp: jest.fn(async () => ({requestId: 'otp-request-1'})),
      verifyOtp: jest.fn(async () => {
        throw new Error('Invalid verification code');
      }),
    };
    const tree = renderer.create(
      <AuthFlowScreen controller={controller} otpService={otpService} />,
    );

    try {
      const phoneInput = tree.root.findByType(TextInput);
      await act(async () => {
        phoneInput.props.onChangeText('+234 801 234 5678');
        await Promise.resolve();
      });

      await act(async () => {
        findButtonByLabel(tree, 'Continue').props.onPress();
        await Promise.resolve();
      });

      const otpInput = tree.root.findByType(TextInput);
      await act(async () => {
        otpInput.props.onChangeText('654321');
        await Promise.resolve();
      });

      await act(async () => {
        findButtonByLabel(tree, 'Verify').props.onPress();
        await Promise.resolve();
      });

      const verifyHeading = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'Verify OTP',
      );
      const errorNodes = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('Invalid verification code'),
      );

      expect(verifyHeading.length).toBeGreaterThan(0);
      expect(errorNodes.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });
});
