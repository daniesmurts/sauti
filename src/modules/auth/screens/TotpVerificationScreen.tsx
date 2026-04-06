import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {Button, Input, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useAuthStore} from '../store/AuthStore';
import {SixDigitCodeInput} from './components/SixDigitCodeInput';

export interface TotpVerificationScreenProps {
  onSuccess(): void;
}

export function TotpVerificationScreen({onSuccess}: TotpVerificationScreenProps): React.JSX.Element {
  const [code, setCode] = React.useState('');
  const [recoveryCode, setRecoveryCode] = React.useState('');
  const [useRecoveryMode, setUseRecoveryMode] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(false);

  const {status, error, verifyTotp, useRecoveryCode, clearError} = useAuthStore();
  const isLoading = status === 'loading';

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleVerify = React.useCallback(async () => {
    if (useRecoveryMode) {
      await useRecoveryCode(recoveryCode);
    } else {
      await verifyTotp(code);
    }

    const snapshot = useAuthStore.getState();
    if (snapshot.status === 'authenticated') {
      onSuccess();
    }
  }, [code, onSuccess, recoveryCode, useRecoveryCode, useRecoveryMode, verifyTotp]);

  return (
    <Screen avoidKeyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Two-factor verification</Text>
        <Text style={styles.description}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Connect to continue.</Text>
          </View>
        ) : null}

        {useRecoveryMode ? (
          <Input
            label="Recovery code"
            value={recoveryCode}
            onChangeText={value => {
              setRecoveryCode(value.toUpperCase());
              if (error) {
                clearError();
              }
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading && !isOffline}
            error={error?.message}
            placeholder="AB12CD34EF"
          />
        ) : (
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
            testIDPrefix="totp-cell"
          />
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="toggle-recovery-mode"
          onPress={() => {
            setUseRecoveryMode(current => !current);
            setCode('');
            setRecoveryCode('');
            clearError();
          }}>
          <Text style={styles.linkText}>
            {useRecoveryMode
              ? 'Use authenticator code instead'
              : 'Use a recovery code instead'}
          </Text>
        </TouchableOpacity>

        <Button
          label={useRecoveryMode ? 'Use Recovery Code' : 'Verify'}
          onPress={() => {
            void handleVerify();
          }}
          loading={isLoading}
          disabled={
            isOffline ||
            (useRecoveryMode ? recoveryCode.trim().length === 0 : code.length < 6)
          }
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
  linkText: {
    ...TextPresets.caption,
    color: Colors.brand[600],
  },
});