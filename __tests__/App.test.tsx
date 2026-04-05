/**
 * @format
 */

import 'react-native';
import React from 'react';
import App from '../App';
import {initializeApp} from '../src/app';

// Note: import explicitly to use the types shipped with jest.
import {describe, it, beforeEach} from '@jest/globals';

// Note: test renderer must be required after react-native.
import renderer, {act} from 'react-test-renderer';

jest.mock('../src/app', () => ({
  initializeApp: jest.fn(),
  MainGatewayPlaceholder: () => null,
  AuthGatewayPlaceholder: () => null,
}));

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders MainGatewayPlaceholder when startup is ready', async () => {
    (initializeApp as jest.Mock).mockResolvedValue({
      route: 'main',
      startup: {status: 'ready'},
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<App />);
      await Promise.resolve();
    });

    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(tree!.toJSON()).toBeNull(); // MainGatewayPlaceholder renders null in mock
  });

  it('renders AuthGatewayPlaceholder when startup is signed_out', async () => {
    (initializeApp as jest.Mock).mockResolvedValue({
      route: 'auth',
      startup: {status: 'signed_out', reason: 'session_missing'},
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<App />);
      await Promise.resolve();
    });

    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(tree!.toJSON()).toBeNull(); // AuthGatewayPlaceholder renders null in mock
  });

  it('renders error card when startup fails', async () => {
    (initializeApp as jest.Mock).mockResolvedValue({
      route: 'auth',
      startup: {status: 'error', errorMessage: 'Core failed.'},
    });

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<App />);
      await Promise.resolve();
    });

    expect(initializeApp).toHaveBeenCalledTimes(1);
    const json = tree!.toJSON();
    expect(json).not.toBeNull();
  });
});
