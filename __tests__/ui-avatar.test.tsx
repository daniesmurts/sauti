import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';
import {Avatar} from '../src/ui/components/Avatar';
import {describe, it, expect} from '@jest/globals';

describe('Avatar', () => {
  it('renders initials from a two-word name', () => {
    const instance = renderer.create(<Avatar name="Kwame Asante" />);
    const texts = instance.root.findAll(node => node.type === 'Text');
    expect(texts[0].props.children).toBe('KA');
  });

  it('renders a single initial from a one-word name', () => {
    const instance = renderer.create(<Avatar name="Amara" />);
    const texts = instance.root.findAll(node => node.type === 'Text');
    expect(texts[0].props.children).toBe('A');
  });

  it('renders ? for an empty name', () => {
    const instance = renderer.create(<Avatar name="" />);
    const texts = instance.root.findAll(node => node.type === 'Text');
    expect(texts[0].props.children).toBe('?');
  });

  it('renders an Image when uri is provided', () => {
    const instance = renderer.create(
      <Avatar name="Kwame Asante" uri="https://example.com/pic.jpg" />,
    );
    const images = instance.root.findAll(node => node.type === 'Image');
    expect(images.length).toBe(1);
    expect(images[0].props.source.uri).toBe('https://example.com/pic.jpg');
  });

  it('renders all sizes without crashing', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      const tree = renderer.create(<Avatar name="Test User" size={size} />).toJSON();
      expect(tree).not.toBeNull();
    }
  });

  it('derives a stable color — same name always gives same background', () => {
    const a = renderer.create(<Avatar name="Chidinma Obi" />);
    const b = renderer.create(<Avatar name="Chidinma Obi" />);

    const aView = a.toJSON() as renderer.ReactTestRendererJSON;
    const bView = b.toJSON() as renderer.ReactTestRendererJSON;

    const aColor = (aView.props as {style: {backgroundColor?: string}[]}).style?.find(
      s => s.backgroundColor,
    )?.backgroundColor;
    const bColor = (bView.props as {style: {backgroundColor?: string}[]}).style?.find(
      s => s.backgroundColor,
    )?.backgroundColor;

    expect(aColor).toBeDefined();
    expect(aColor).toBe(bColor);
  });
});
