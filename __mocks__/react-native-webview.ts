/**
 * Jest manual mock for react-native-webview.
 */

import React from 'react';
import {View} from 'react-native';

const WebView = ({onMessage, onNavigationStateChange, testID}: {
  source?: {uri?: string; html?: string};
  onMessage?: (event: {nativeEvent: {data: string}}) => void;
  onNavigationStateChange?: (state: {url: string}) => void;
  testID?: string;
  style?: object;
}) => {
  return React.createElement(View, {testID: testID ?? 'webview'});
};

WebView._onMessage = null as ((data: string) => void) | null;
WebView._onNavigationStateChange = null as ((url: string) => void) | null;

export default WebView;
export {WebView};
