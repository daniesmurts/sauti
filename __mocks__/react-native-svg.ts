/**
 * Jest manual mock for react-native-svg.
 * Required by react-native-qrcode-svg; auto-used by Jest from __mocks__/.
 */

import React from 'react';
import {View} from 'react-native';

const svgMock = ({children, testID}: {children?: React.ReactNode; testID?: string}) =>
  React.createElement(View, {testID}, children);

const names = [
  'Svg', 'Circle', 'Ellipse', 'Rect', 'Line', 'Polygon', 'Polyline',
  'Path', 'G', 'Text', 'TSpan', 'TextPath', 'Use', 'Image',
  'Symbol', 'Defs', 'LinearGradient', 'RadialGradient', 'Stop',
  'ClipPath', 'Pattern', 'Mask',
];

const mocks: Record<string, typeof svgMock> = {default: svgMock};
names.forEach(n => { mocks[n] = svgMock; });

export default svgMock;
export const {
  Svg, Circle, Ellipse, Rect, Line, Polygon, Polyline,
  Path, G, Text, TSpan, TextPath, Use, Image,
  Symbol, Defs, LinearGradient, RadialGradient, Stop,
  ClipPath, Pattern, Mask,
} = mocks as Record<string, typeof svgMock>;
