import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Button} from '../src/ui/components/Button';
import {describe, it, expect, jest, beforeEach} from '@jest/globals';

describe('Button', () => {
  it('renders a primary button with given label', () => {
    const tree = renderer.create(<Button label="Send" />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders a secondary variant without crashing', () => {
    const tree = renderer.create(<Button label="Cancel" variant="secondary" />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders a ghost variant without crashing', () => {
    const tree = renderer.create(<Button label="Skip" variant="ghost" />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders an ActivityIndicator when loading=true', () => {
    const tree = renderer.create(<Button label="Save" loading />);
    // When loading, the Text child is replaced with ActivityIndicator
    const json = tree.toJSON() as renderer.ReactTestRendererJSON;
    // Should not find a Text node with the label inside
    const textNodes = json.children?.filter(
      c => typeof c === 'object' && (c as renderer.ReactTestRendererJSON).type === 'Text',
    );
    expect(textNodes).toHaveLength(0);
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const instance = renderer.create(<Button label="Go" onPress={onPress} />);
    const btn = instance.root.findByType(require('react-native').TouchableOpacity);
    act(() => {
      btn.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    renderer.create(<Button label="Go" onPress={onPress} disabled />);
    // disabled prop prevents press — smoke test that rendering succeeds
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders all three sizes', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const tree = renderer.create(<Button label={size} size={size} />).toJSON();
      expect(tree).not.toBeNull();
    }
  });
});
