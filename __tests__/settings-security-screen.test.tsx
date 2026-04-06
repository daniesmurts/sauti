import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';

import {SettingsSecurityScreen} from '../src/modules/settings/screens/SettingsSecurityScreen';
import {type SessionManagementGateway} from '../src/modules/settings/data/SessionManagementGateway';

function flushPromises(): Promise<void> {
  return Promise.resolve();
}

describe('SettingsSecurityScreen', () => {
  it('renders active sessions from gateway', async () => {
    const gateway: SessionManagementGateway = {
      listSessions: jest.fn(async () => [
        {
          deviceId: 'DEVICE_A',
          displayName: 'Pixel 8',
          lastSeenIp: '10.0.0.4',
          lastSeenTs: 1_710_000_000_000,
          isCurrent: true,
        },
      ]),
      revokeSession: jest.fn(async () => undefined),
    };

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SettingsSecurityScreen gateway={gateway} />);
      await flushPromises();
    });

    try {
      expect(tree.root.findAllByProps({children: 'Active Sessions'}).length).toBeGreaterThan(0);
      expect(tree.root.findAllByProps({children: 'Pixel 8'}).length).toBeGreaterThan(0);
      expect(gateway.listSessions).toHaveBeenCalledTimes(1);
    } finally {
      act(() => {
        tree.unmount();
      });
    }
  });

  it('revokes a non-current session and refreshes list', async () => {
    const sessions = [
      {
        deviceId: 'DEVICE_A',
        displayName: 'Current Device',
        isCurrent: true,
      },
      {
        deviceId: 'DEVICE_B',
        displayName: 'Old Device',
        isCurrent: false,
      },
    ];

    const gateway: SessionManagementGateway = {
      listSessions: jest.fn(async () => sessions),
      revokeSession: jest.fn(async () => undefined),
    };

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<SettingsSecurityScreen gateway={gateway} />);
      await flushPromises();
    });

    try {
      const revokeButton = tree.root.find(
        node =>
          node.type === TouchableOpacity &&
          node.props.accessibilityLabel === 'Revoke session',
      );

      await act(async () => {
        revokeButton.props.onPress();
        await flushPromises();
      });

      expect(gateway.revokeSession).toHaveBeenCalledWith('DEVICE_B');
      expect(gateway.listSessions).toHaveBeenCalledTimes(2);
    } finally {
      act(() => {
        tree.unmount();
      });
    }
  });
});
