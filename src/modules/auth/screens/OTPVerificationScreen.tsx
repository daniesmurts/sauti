import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

export interface OTPSubmitPayload {
  otpCode: string;
  displayName?: string;
}

export interface OTPVerificationScreenProps {
  phoneNumber: string;
  loading?: boolean;
  errorMessage?: string;
  onBack(): void;
  onSubmit(payload: OTPSubmitPayload): void;
}

function isValidOtpCode(value: string): boolean {
  return /^\d{4,8}$/.test(value);
}

export function OTPVerificationScreen({
  phoneNumber,
  loading = false,
  errorMessage,
  onBack,
  onSubmit,
}: OTPVerificationScreenProps): React.JSX.Element {
  const [otpCode, setOtpCode] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [localError, setLocalError] = React.useState<string | undefined>();

  const handleSubmit = React.useCallback(() => {
    const normalizedOtp = otpCode.trim();

    if (!isValidOtpCode(normalizedOtp)) {
      setLocalError('Enter the OTP code sent to your phone.');
      return;
    }

    setLocalError(undefined);
    const normalizedDisplayName = displayName.trim();

    onSubmit({
      otpCode: normalizedOtp,
      displayName: normalizedDisplayName.length > 0 ? normalizedDisplayName : undefined,
    });
  }, [displayName, onSubmit, otpCode]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={[TextPresets.h2, styles.title]}>Verify OTP</Text>
        <Text style={[TextPresets.body, styles.description]}>
          Use the verification code sent to {phoneNumber}.
        </Text>

        <Input
          label="OTP Code"
          value={otpCode}
          onChangeText={value => {
            setOtpCode(value);
            if (localError) {
              setLocalError(undefined);
            }
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="123456"
          maxLength={8}
          error={localError}
          editable={!loading}
        />

        <Input
          label="Display Name (Optional)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCorrect={false}
          autoCapitalize="words"
          placeholder="Kwame"
          editable={!loading}
        />

        {errorMessage ? (
          <Text style={styles.remoteError}>{errorMessage}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Back"
            variant="ghost"
            onPress={onBack}
            disabled={loading}
          />
          <Button
            label="Verify"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading || otpCode.trim().length === 0}
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
  },
  remoteError: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
});
