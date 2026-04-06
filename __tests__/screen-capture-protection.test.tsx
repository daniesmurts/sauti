import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest} from '@jest/globals';

import {ChatRoomScreen} from '../src/modules/main/screens/ChatRoomScreen';
import {
  setScreenCaptureProtection,
  useScreenCaptureProtection,
} from '../src/core/security/screenCaptureProtection';

const screenshotPrevent = jest.requireMock('react-native-screenshot-prevent') as {
  enabled: jest.Mock;
};

describe('screen capture protection', () => {
  function ProtectedTestScreen(): React.JSX.Element {
    useScreenCaptureProtection(true);
    return <></>;
  }

  it('enables and disables protection for chat room lifecycle', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ChatRoomScreen
          room={{roomId: '!r:sauti.app', displayName: 'Kwame Asante', isOnline: true}}
          messages={[]}
          draftMessage=""
          onBack={() => {}}
          onDraftChange={() => {}}
          onSend={() => {}}
        />,
      );
    });

    try {
      expect(screenshotPrevent.enabled).toHaveBeenCalledWith(true);
    } finally {
      act(() => {
        tree.unmount();
      });
    }

    expect(screenshotPrevent.enabled).toHaveBeenCalledWith(false);
  });

  it('enables and disables protection through the reusable hook', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<ProtectedTestScreen />);
    });

    try {
      expect(screenshotPrevent.enabled).toHaveBeenCalledWith(true);
    } finally {
      act(() => {
        tree.unmount();
      });
    }

    expect(screenshotPrevent.enabled).toHaveBeenCalledWith(false);
  });

  it('supports direct set API for non-hook callers', () => {
    setScreenCaptureProtection(true);
    setScreenCaptureProtection(false);

    expect(screenshotPrevent.enabled).toHaveBeenCalledWith(true);
    expect(screenshotPrevent.enabled).toHaveBeenCalledWith(false);
  });
});
