import {TextStyle} from 'react-native';

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const FontWeight: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const LineHeight = {
  tight: 16,
  snug: 20,
  normal: 22,
  relaxed: 26,
  loose: 32,
} as const;

/** Pre-composed text style presets. */
export const TextPresets = {
  /** 24 / bold — screen headings */
  h1: {fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, lineHeight: LineHeight.loose} as TextStyle,
  /** 20 / semibold — section headings */
  h2: {fontSize: FontSize.xl, fontWeight: FontWeight.semibold, lineHeight: LineHeight.relaxed} as TextStyle,
  /** 17 / semibold — card headings */
  h3: {fontSize: FontSize.lg, fontWeight: FontWeight.semibold, lineHeight: LineHeight.relaxed} as TextStyle,
  /** 15 / regular — body copy */
  body: {fontSize: FontSize.md, fontWeight: FontWeight.regular, lineHeight: LineHeight.normal} as TextStyle,
  /** 13 / regular — captions, timestamps */
  caption: {fontSize: FontSize.sm, fontWeight: FontWeight.regular, lineHeight: LineHeight.snug} as TextStyle,
  /** 11 / medium — tags, badges */
  label: {fontSize: FontSize.xs, fontWeight: FontWeight.medium, lineHeight: LineHeight.tight} as TextStyle,
} as const;
