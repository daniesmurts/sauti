import 'react-native';
import React from 'react';
import renderer from 'react-test-renderer';

import {MainGatewayPlaceholder} from '../src/app/MainGatewayPlaceholder';

jest.mock('../src/app/RootNavigator', () => ({
  RootNavigator: () => null,
}));

describe('MainGatewayPlaceholder', () => {
  it('renders the root navigator for authenticated users', () => {
    const tree = renderer.create(<MainGatewayPlaceholder />);

    try {
      expect(tree.toJSON()).toBeNull();
    } finally {
      tree.unmount();
    }
  });
});
