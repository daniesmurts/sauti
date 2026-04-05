import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';
import {Screen} from '../src/ui/components/Screen';
import {Text} from 'react-native';
import {describe, it, expect} from '@jest/globals';

describe('Screen', () => {
  it('renders children without crashing', () => {
    const tree = renderer
      .create(
        <Screen>
          <Text>Hello</Text>
        </Screen>,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders children in a scrollable variant', () => {
    const tree = renderer
      .create(
        <Screen scrollable>
          <Text>Scrollable content</Text>
        </Screen>,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders with keyboard avoidance enabled', () => {
    const tree = renderer
      .create(
        <Screen avoidKeyboard>
          <Text>Form content</Text>
        </Screen>,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders with both scrollable and avoidKeyboard', () => {
    const tree = renderer
      .create(
        <Screen scrollable avoidKeyboard>
          <Text>Both</Text>
        </Screen>,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('passes testID to the root SafeAreaView', () => {
    const instance = renderer.create(
      <Screen testID="my-screen">
        <Text>Inner</Text>
      </Screen>,
    );
    const safeArea = instance.root.findAll(
      node => node.props.testID === 'my-screen',
    );
    expect(safeArea.length).toBeGreaterThanOrEqual(1);
  });
});
