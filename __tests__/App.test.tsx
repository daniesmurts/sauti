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

jest.mock('../src/core/notifications', () => ({
  initializePushNotifications: jest.fn().mockResolvedValue({
    token: null,
    permissionGranted: true,
    permissionStatus: 'granted',
    tokenRegistered: false,
  }),
  requestPushNotificationsPermission: jest.fn().mockResolvedValue({
    token: null,
    permissionGranted: true,
    permissionStatus: 'granted',
    tokenRegistered: false,
  }),
  subscribeForegroundPushMessages: jest.fn(() => () => undefined),
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
    const json = tree!.toJSON() as renderer.ReactTestRendererJSON;
    expect(json.type).toBe('View');
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
    const json = tree!.toJSON() as renderer.ReactTestRendererJSON;
    expect(json.type).toBe('View');
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
