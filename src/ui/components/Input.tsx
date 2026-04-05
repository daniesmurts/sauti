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
}

export function Input({
  label,
  error,
  editable = true,
  ...rest
}: InputProps): React.JSX.Element {
  const borderColor = error
    ? Colors.semantic.error
    : Colors.neutral[300];

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}

      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.neutral[400]}
        {...rest}
        editable={editable}
        style={[
          styles.input,
          {borderColor},
          !editable && styles.inputDisabled,
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
    color: Colors.neutral[700],
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    fontSize: FontSize.md,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[0],
  },
  inputDisabled: {
    backgroundColor: Colors.neutral[100],
    color: Colors.neutral[500],
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.semantic.error,
    fontWeight: FontWeight.medium,
  },
});
