import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';
import {MessageBubble} from '../src/ui/components/MessageBubble';
import {describe, it, expect} from '@jest/globals';

describe('MessageBubble', () => {
  it('renders outgoing bubble without crashing', () => {
    const tree = renderer
      .create(
        <MessageBubble
          text="Hello, how are you?"
          direction="outgoing"
          timestamp="14:32"
        />,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders incoming bubble without crashing', () => {
    const tree = renderer
      .create(
        <MessageBubble
          text="I am fine, thanks!"
          direction="incoming"
          timestamp="14:33"
        />,
      )
      .toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders the message text', () => {
    const instance = renderer.create(
      <MessageBubble text="Test message" direction="outgoing" timestamp="10:00" />,
    );
    const texts = instance.root.findAll(
      node => node.type === 'Text' && node.props.children === 'Test message',
    );
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the timestamp', () => {
    const instance = renderer.create(
      <MessageBubble text="Hi" direction="outgoing" timestamp="09:15" />,
    );
    const texts = instance.root.findAll(
      node => node.type === 'Text' && node.props.children === '09:15',
    );
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status symbol for outgoing with status', () => {
    const instance = renderer.create(
      <MessageBubble text="Hi" direction="outgoing" timestamp="09:15" status="delivered" />,
    );
    const texts = instance.root.findAll(
      node => node.type === 'Text' && node.props.children === '✓✓',
    );
    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render status for incoming direction', () => {
    const instance = renderer.create(
      <MessageBubble text="Hi" direction="incoming" timestamp="09:15" status="delivered" />,
    );
    const texts = instance.root.findAll(
      node => node.type === 'Text' && (node.props.children === '✓✓' || node.props.children === '✓'),
    );
    expect(texts.length).toBe(0);
  });

  it('renders all four status symbols', () => {
    const pairs: Array<[import('../src/ui/components/MessageBubble').MessageStatus, string]> = [
      ['sending', '○'],
      ['sent', '✓'],
      ['delivered', '✓✓'],
      ['read', '✓✓'],
    ];

    for (const [status, symbol] of pairs) {
      const instance = renderer.create(
        <MessageBubble text="x" direction="outgoing" timestamp="t" status={status} />,
      );
      const texts = instance.root.findAll(
        node => node.type === 'Text' && node.props.children === symbol,
      );
      expect(texts.length).toBeGreaterThanOrEqual(1);
    }
  });
});
