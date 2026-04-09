jest.mock('react-native-screens', () => {
  const RN = require('react-native');
  return {
    enableScreens: jest.fn(),
    Screen: RN.View,
    ScreenContainer: RN.View,
    NativeScreen: RN.View,
    NativeScreenContainer: RN.View,
    ScreenStack: RN.View,
    ScreenStackHeaderConfig: RN.View,
    ScreenStackHeaderSubview: RN.View,
    FullWindowOverlay: RN.View,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    Swipeable: ({children, renderRightActions}) =>
      React.createElement(
        View,
        null,
        children,
        typeof renderRightActions === 'function' ? renderRightActions() : null,
      ),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => undefined),
  fetch: jest.fn(async () => ({
    isConnected: true,
  })),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-config', () => ({}));

jest.mock('react-native-screenshot-prevent', () => ({
  enabled: jest.fn(),
  enableSecureView: jest.fn(),
  disableSecureView: jest.fn(),
}));

jest.mock('react-native-ssl-public-key-pinning', () => ({
  isSslPinningAvailable: jest.fn(() => true),
  initializeSslPinning: jest.fn(async () => undefined),
}));
