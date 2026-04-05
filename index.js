/**
 * @format
 */

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import {TextEncoder, TextDecoder} from 'text-encoding';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
