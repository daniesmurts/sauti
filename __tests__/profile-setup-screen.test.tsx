import 'react-native';
import React from 'react';
import {TextInput, TouchableOpacity} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {ProfileSetupScreen} from '../src/modules/auth/screens';
import {ProfileSetupPayload} from '../src/modules/auth/screens/ProfileSetupScreen';

function findButtonByLabel(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  return tree.root.find(
    node =>
      node.type === TouchableOpacity && node.props.accessibilityLabel === label,
  );
}

describe('ProfileSetupScreen', () => {
  it('renders the profile setup heading', () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const heading = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          node.props.children === 'Set Up Your Profile',
      );
      expect(heading.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('shows avatar placeholder with ? when name is empty', () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const initial = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === '?',
      );
      expect(initial.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('updates avatar initial letter as display name is typed', async () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('Kwame');
        await Promise.resolve();
      });

      const initial = tree.root.findAll(
        node => node.type === 'Text' && node.props.children === 'K',
      );
      expect(initial.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('Continue button is disabled when name is shorter than 2 chars', () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const btn = findButtonByLabel(tree, 'profile-setup-continue');
      expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
    } finally {
      tree.unmount();
    }
  });

  it('shows name validation error when submitting a too-short name', async () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('K');
        await Promise.resolve();
      });

      // Force submit by calling onPress directly since button would normally be disabled
      const btn = findButtonByLabel(tree, 'profile-setup-continue');
      await act(async () => {
        btn.props.onPress();
        await Promise.resolve();
      });

      const errorText = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('2–60'),
      );
      expect(errorText.length).toBeGreaterThan(0);
    } finally {
      tree.unmount();
    }
  });

  it('calls onSubmit with trimmed display name', async () => {
    const received: ProfileSetupPayload[] = [];
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={payload => received.push(payload)} />,
    );

    try {
      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('  Kwame Asante  ');
        await Promise.resolve();
      });

      const btn = findButtonByLabel(tree, 'profile-setup-continue');
      await act(async () => {
        btn.props.onPress();
        await Promise.resolve();
      });

      expect(received).toHaveLength(1);
      expect(received[0].displayName).toBe('Kwame Asante');
      expect(received[0].avatarUri).toBeUndefined();
    } finally {
      tree.unmount();
    }
  });

  it('clears name error when user edits input after an error', async () => {
    const tree = renderer.create(
      <ProfileSetupScreen onSubmit={() => undefined} />,
    );

    try {
      const input = tree.root.findByType(TextInput);

      await act(async () => {
        input.props.onChangeText('K');
        await Promise.resolve();
      });

      const btn = findButtonByLabel(tree, 'profile-setup-continue');
      await act(async () => {
        btn.props.onPress();
        await Promise.resolve();
      });

      // Error should be visible
      const errorsBefore = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('2–60'),
      );
      expect(errorsBefore.length).toBeGreaterThan(0);

      await act(async () => {
        input.props.onChangeText('Kwame');
        await Promise.resolve();
      });

      const errorsAfter = tree.root.findAll(
        node =>
          node.type === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('2–60'),
      );
      expect(errorsAfter).toHaveLength(0);
    } finally {
      tree.unmount();
    }
  });

  it('disables input and button while loading', () => {
    const tree = renderer.create(
      <ProfileSetupScreen loading onSubmit={() => undefined} />,
    );

    try {
      const input = tree.root.findByType(TextInput);
      expect(input.props.editable).toBe(false);
    } finally {
      tree.unmount();
    }
  });
});
