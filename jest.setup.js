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
