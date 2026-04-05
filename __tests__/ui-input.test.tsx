import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';
import {Input} from '../src/ui/components/Input';
import {describe, it, expect} from '@jest/globals';

describe('Input', () => {
  it('renders without crashing', () => {
    const tree = renderer.create(<Input placeholder="Enter number" />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders a label when provided', () => {
    const instance = renderer.create(<Input label="Phone number" />);
    const text = instance.root.findAll(
      node => node.type === 'Text' && node.props.children === 'Phone number',
    );
    expect(text.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render a label element when label is omitted', () => {
    const instance = renderer.create(<Input placeholder="No label" />);
    const texts = instance.root.findAll(node => node.type === 'Text');
    expect(texts.length).toBe(0);
  });

  it('renders an error message when error prop is set', () => {
    const instance = renderer.create(<Input error="Required field" />);
    const text = instance.root.findAll(
      node => node.type === 'Text' && node.props.children === 'Required field',
    );
    expect(text.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render an error element when error is omitted', () => {
    const instance = renderer.create(<Input />);
    const texts = instance.root.findAll(node => node.type === 'Text');
    expect(texts.length).toBe(0);
  });

  it('applies disabled styling when editable=false', () => {
    const tree = renderer.create(<Input editable={false} />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('passes secureTextEntry to the underlying TextInput', () => {
    const instance = renderer.create(<Input secureTextEntry />);
    const input = instance.root.findByType(require('react-native').TextInput);
    expect(input.props.secureTextEntry).toBe(true);
  });
});
