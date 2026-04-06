import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useAuthStore} from '../store/AuthStore';

import {SixDigitCodeInput} from './components/SixDigitCodeInput';

export interface OtpVerificationScreenProps {
  email: string;
  mode: 'signup' | 'signin';
  onVerified(hasTotpEnabled: boolean): void;
  onBack(): void;
}

const RESEND_TIMEOUT_SECONDS = 60;

export function OtpVerificationScreen({
  email,
  mode,
  onVerified,
  onBack,
}: OtpVerificationScreenProps): React.JSX.Element {
  const [code, setCode] = React.useState('');
  const [secondsRemaining, setSecondsRemaining] = React.useState(RESEND_TIMEOUT_SECONDS);
  const [isOffline, setIsOffline] = React.useState(false);

  const {status, error, sendOtp, verifyOtp, clearError} = useAuthStore();

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining(current => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isLoading = status === 'loading';

  const submitCode = React.useCallback(async () => {
    await verifyOtp(code);
    const snapshot = useAuthStore.getState();

    if (snapshot.status === 'authenticated' || snapshot.status === 'otp_sent') {
      onVerified(snapshot.hasTotpEnabled);
    }
  }, [code, onVerified, verifyOtp]);

  React.useEffect(() => {
    if (code.length === 6 && !isLoading) {
      void submitCode();
    }
  }, [code, isLoading, submitCode]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.description}>We sent a 6-digit code to {email}</Text>

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Connect to continue.</Text>
          </View>
        ) : null}

        <SixDigitCodeInput
          value={code}
          onChange={value => {
            setCode(value);
            if (error) {
              clearError();
            }
          }}
          editable={!isLoading && !isOffline}
          errorMessage={error?.message}
        />

        <View style={styles.row}>
          <Button label="Back" variant="ghost" onPress={onBack} disabled={isLoading} />
          <Button
            label="Verify"
            onPress={() => {
              void submitCode();
            }}
            loading={isLoading}
            disabled={code.length < 6 || isOffline}
          />
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="resend-otp"
          disabled={secondsRemaining > 0 || isLoading || isOffline}
          onPress={() => {
            void sendOtp(email, mode === 'signup');
            setSecondsRemaining(RESEND_TIMEOUT_SECONDS);
            setCode('');
          }}>
          <Text style={styles.resendText}>
            {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

export interface OTPSubmitPayload {
  otpCode: string;
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
  const [localError, setLocalError] = React.useState<string | undefined>();

  const handleSubmit = React.useCallback(() => {
    const normalizedOtp = otpCode.trim();

    if (!isValidOtpCode(normalizedOtp)) {
      setLocalError('Enter the OTP code sent to your phone.');
      return;
    }

    setLocalError(undefined);
    onSubmit({otpCode: normalizedOtp});
  }, [onSubmit, otpCode]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.description}>Use the verification code sent to {phoneNumber}.</Text>

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

        {errorMessage ? <Text style={styles.remoteError}>{errorMessage}</Text> : null}

        <View style={styles.actions}>
          <Button label="Back" variant="ghost" onPress={onBack} disabled={loading} />
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
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  description: {
    ...TextPresets.body,
    color: Colors.neutral[600],
  },
  offlineBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.semantic.warning,
    backgroundColor: Colors.neutral[0],
    padding: Spacing.sm,
  },
  offlineText: {
    ...TextPresets.caption,
    color: Colors.semantic.warning,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  resendText: {
    ...TextPresets.caption,
    color: Colors.brand[600],
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