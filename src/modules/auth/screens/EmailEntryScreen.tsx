import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useAuthStore} from '../store/AuthStore';

export interface EmailEntryScreenProps {
  onOtpSent(email: string, mode: 'signup' | 'signin'): void;
}

export function EmailEntryScreen({onOtpSent}: EmailEntryScreenProps): React.JSX.Element {
  const [email, setEmail] = React.useState('');
  const [mode, setMode] = React.useState<'signup' | 'signin'>('signup');
  const [isOffline, setIsOffline] = React.useState(false);

  const {status, error, sendOtp, clearError} = useAuthStore();

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isLoading = status === 'loading';

  const handleContinue = React.useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    await sendOtp(normalizedEmail, mode === 'signup');

    const snapshot = useAuthStore.getState();
    if (snapshot.status === 'otp_sent') {
      onOtpSent(normalizedEmail, mode);
    }
  }, [email, mode, onOtpSent, sendOtp]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Sign in to Sauti</Text>
        <Text style={styles.description}>
          Enter your email to receive a 6-digit verification code.
        </Text>

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Connect to continue.</Text>
          </View>
        ) : null}

        <Input
          label="Email"
          value={email}
          onChangeText={value => {
            setEmail(value);
            if (error) {
              clearError();
            }
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          placeholder="name@example.com"
          error={error?.message}
        />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="toggle-auth-mode"
          activeOpacity={0.8}
          onPress={() => {
            setMode(current => (current === 'signup' ? 'signin' : 'signup'));
            clearError();
          }}>
          <Text style={styles.toggleText}>
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : 'Need a new account? Sign up'}
          </Text>
        </TouchableOpacity>

        <Button
          label="Continue"
          onPress={() => {
            void handleContinue();
          }}
          disabled={email.trim().length === 0 || isOffline}
          loading={isLoading}
        />
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
  toggleText: {
    ...TextPresets.caption,
    color: Colors.brand[600],
  },
});