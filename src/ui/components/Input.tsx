import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import {Colors} from '../tokens/colors';
import {Radius, Spacing} from '../tokens/spacing';
import {FontSize, FontWeight} from '../tokens/typography';

export interface InputProps
  extends Omit<TextInputProps, 'style' | 'keyboardType'> {
  label?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Use dark variant for inputs on dark-background screens. */
  dark?: boolean;
}

export function Input({
  label,
  error,
  editable = true,
  dark = false,
  ...rest
}: InputProps): React.JSX.Element {
  const borderColor = error
    ? Colors.semantic.error
    : dark
      ? Colors.neutral[700]
      : Colors.neutral[200];

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      ) : null}

      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={dark ? Colors.neutral[600] : Colors.neutral[400]}
        {...rest}
        editable={editable}
        style={[
          styles.input,
          dark && styles.inputDark,
          {borderColor},
          !editable && (dark ? styles.inputDisabledDark : styles.inputDisabled),
        ]}
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.neutral[600],
  },
  labelDark: {
    color: Colors.neutral[400],
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    fontSize: FontSize.md,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[0],
  },
  inputDark: {
    backgroundColor: Colors.neutral[800],
    color: Colors.neutral[50],
  },
  inputDisabled: {
    backgroundColor: Colors.neutral[100],
    color: Colors.neutral[500],
  },
  inputDisabledDark: {
    backgroundColor: Colors.neutral[700],
    color: Colors.neutral[500],
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.semantic.error,
    fontWeight: FontWeight.medium,
  },
});
