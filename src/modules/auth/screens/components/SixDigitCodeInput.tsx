import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Colors, Spacing, TextPresets} from '../../../../ui/tokens';

interface SixDigitCodeInputProps {
  value: string;
  onChange(value: string): void;
  editable?: boolean;
  errorMessage?: string;
  testIDPrefix?: string;
}

export function SixDigitCodeInput({
  value,
  onChange,
  editable = true,
  errorMessage,
  testIDPrefix = 'otp-cell',
}: SixDigitCodeInputProps): React.JSX.Element {
  const inputRefs = React.useRef<Array<TextInput | null>>([]);
  const digits = React.useMemo(() => {
    const normalized = value.replace(/\D/g, '').slice(0, 6);
    return Array.from({length: 6}, (_, index) => normalized[index] ?? '');
  }, [value]);

  const handleChangeDigit = React.useCallback(
    (index: number, text: string) => {
      const onlyDigits = text.replace(/\D/g, '');
      const nextDigits = [...digits];

      if (onlyDigits.length === 0) {
        nextDigits[index] = '';
      } else {
        nextDigits[index] = onlyDigits[onlyDigits.length - 1];
      }

      const merged = nextDigits.join('').slice(0, 6);
      onChange(merged);

      if (onlyDigits.length > 0 && index < inputRefs.current.length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, onChange],
  );

  const handleBackspace = React.useCallback(
    (index: number, key: string) => {
      if (key !== 'Backspace') {
        return;
      }

      if (digits[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  return (
    <View>
      <View style={styles.container}>
        {digits.map((digit, index) => (
          <TextInput
            key={`digit-${index}`}
            ref={ref => {
              inputRefs.current[index] = ref;
            }}
            testID={`${testIDPrefix}-${index}`}
            value={digit}
            style={[styles.cell, errorMessage ? styles.cellError : null]}
            keyboardType="number-pad"
            maxLength={1}
            editable={editable}
            onChangeText={text => handleChangeDigit(index, text)}
            onKeyPress={event => handleBackspace(index, event.nativeEvent.key)}
            textAlign="center"
          />
        ))}
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  cell: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 10,
    backgroundColor: Colors.neutral[0],
    height: 52,
    fontSize: 20,
    color: Colors.neutral[900],
  },
  cellError: {
    borderColor: Colors.semantic.error,
  },
  error: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
    marginTop: Spacing.xs,
  },
});