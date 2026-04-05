import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import {Colors} from '../tokens/colors';
import {Radius, Spacing} from '../tokens/spacing';
import {FontSize, FontWeight} from '../tokens/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.75}
      {...rest}
      disabled={isDisabled}
      style={[styles.base, styles[variant], styles[size], isDisabled && styles.disabled, style]}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.neutral[0] : Colors.brand[500]}
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`], styles[`${size}Label`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  disabled: {
    opacity: 0.45,
  },

  // --- variants ---
  primary: {
    backgroundColor: Colors.brand[500],
  },
  secondary: {
    backgroundColor: Colors.neutral[0],
    borderWidth: 1.5,
    borderColor: Colors.brand[500],
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // --- sizes ---
  sm: {paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md},
  md: {paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.base},
  lg: {paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl},

  // --- label base ---
  label: {
    fontWeight: FontWeight.semibold,
  },

  // --- variant labels ---
  primaryLabel: {color: Colors.neutral[0]},
  secondaryLabel: {color: Colors.brand[500]},
  ghostLabel: {color: Colors.brand[500]},

  // --- size labels ---
  smLabel: {fontSize: FontSize.sm},
  mdLabel: {fontSize: FontSize.md},
  lgLabel: {fontSize: FontSize.lg},
});
