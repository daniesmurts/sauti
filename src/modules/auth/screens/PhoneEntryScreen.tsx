import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

export interface PhoneEntryScreenProps {
  initialPhoneNumber?: string;
  disabled?: boolean;
  errorMessage?: string;
  onContinue(phoneNumber: string): void;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function isValidPhoneNumber(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value);
}

export function PhoneEntryScreen({
  initialPhoneNumber = '',
  disabled = false,
  errorMessage,
  onContinue,
}: PhoneEntryScreenProps): React.JSX.Element {
  const [phoneNumber, setPhoneNumber] = React.useState(initialPhoneNumber);
  const [error, setError] = React.useState<string | undefined>();

  const handleContinue = React.useCallback(() => {
    const normalized = normalizePhoneNumber(phoneNumber.trim());

    if (!isValidPhoneNumber(normalized)) {
      setError('Enter a valid phone number in international format.');
      return;
    }

    setError(undefined);
    onContinue(normalized);
  }, [onContinue, phoneNumber]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={[TextPresets.h2, styles.title]}>Sign in to Sauti</Text>
        <Text style={[TextPresets.body, styles.description]}>
          Enter your phone number to continue to OTP verification.
        </Text>

        <Input
          label="Phone Number"
          value={phoneNumber}
          onChangeText={value => {
            setPhoneNumber(value);
            if (error) {
              setError(undefined);
            }
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="+2348012345678"
          error={error}
          editable={!disabled}
        />

        {errorMessage ? <Text style={styles.remoteError}>{errorMessage}</Text> : null}

        <View style={styles.cta}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={disabled || phoneNumber.trim().length === 0}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.base,
  },
  title: {
    color: Colors.neutral[900],
  },
  description: {
    color: Colors.neutral[600],
    marginBottom: Spacing.sm,
  },
  remoteError: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
  cta: {
    marginTop: Spacing.sm,
  },
});
