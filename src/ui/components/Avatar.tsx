import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {Colors} from '../tokens/colors';
import {FontWeight} from '../tokens/typography';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Display name used to derive initials when no uri is supplied. */
  name: string;
  uri?: string;
  size?: AvatarSize;
  testID?: string;
}

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 52,
  xl: 72,
};

const FONT_MAP: Record<AvatarSize, number> = {
  xs: 9,
  sm: 12,
  md: 15,
  lg: 19,
  xl: 26,
};

/**
 * Derives a stable background color from the display name so every
 * contact always renders the same color without storing it.
 */
function deriveColor(name: string): string {
  const palette = [
    Colors.brand[400],
    Colors.brand[600],
    '#7C3AED', // violet-600
    '#DB2777', // pink-600
    '#D97706', // amber-600
    '#059669', // emerald-600
    '#DC2626', // red-600
    '#2563EB', // blue-600
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  uri,
  size = 'md',
  testID,
}: AvatarProps): React.JSX.Element {
  const dim = SIZE_MAP[size];
  const border = dim / 2;

  if (uri) {
    return (
      <Image
        testID={testID}
        accessibilityLabel={`${name} avatar`}
        source={{uri}}
        style={[styles.base, {width: dim, height: dim, borderRadius: border}]}
      />
    );
  }

  return (
    <View
      testID={testID}
      accessibilityLabel={`${name} avatar`}
      style={[
        styles.base,
        {
          width: dim,
          height: dim,
          borderRadius: border,
          backgroundColor: deriveColor(name),
        },
      ]}>
      <Text style={[styles.initials, {fontSize: FONT_MAP[size]}]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: Colors.neutral[0],
    fontWeight: FontWeight.bold,
    includeFontPadding: false,
  },
});
