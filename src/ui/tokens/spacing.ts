/**
 * 4 px base unit spacing scale.
 * Use these constants everywhere instead of magic numbers.
 */
export const Spacing = {
  /** 2px */
  xxs: 2,
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  base: 16,
  /** 20px */
  lg: 20,
  /** 24px */
  xl: 24,
  /** 32px */
  '2xl': 32,
  /** 40px */
  '3xl': 40,
  /** 48px */
  '4xl': 48,
  /** 64px */
  '5xl': 64,
} as const;

export type SpacingKey = keyof typeof Spacing;

/** Border radius tokens */
export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;
