import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';

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
        {/* Brand mark */}
        <Text style={styles.brand}>SAUTI</Text>

        {/* Heading */}
        <Text style={styles.title}>Enter Your{'\n'}Number</Text>
        <Text style={styles.description}>
          We'll send a verification code to secure your account.
        </Text>

        <Input
          label="Mobile Phone"
          value={phoneNumber}
          onChangeText={value => {
            setPhoneNumber(value);
            if (error) setError(undefined);
          }}
          keyboardType="phone-pad"
          autoComplete="tel"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="+254 700 000 000"
          error={error}
          editable={!disabled}
        />

        {errorMessage ? <Text style={styles.remoteError}>{errorMessage}</Text> : null}

        <View style={styles.cta}>
          <Button
            label="Send Code"
            size="lg"
            onPress={handleContinue}
            disabled={disabled || phoneNumber.trim().length === 0}
          />
        </View>

        {/* Security indicator */}
        <View style={styles.securityBadge}>
          <View style={styles.securityDot} />
          <Text style={styles.securityText}>SECURE TUNNEL: ACTIVE</Text>
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
    paddingBottom: Spacing['2xl'],
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: Colors.brand[500],
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.neutral[900],
    lineHeight: 38,
    marginTop: Spacing.xs,
  },
  description: {
    ...TextPresets.body,
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
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignSelf: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.semantic.success,
    backgroundColor: Colors.semantic.successBg,
  },
  securityDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.semantic.success,
  },
  securityText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: Colors.semantic.success,
  },
});
