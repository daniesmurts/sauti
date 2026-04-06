import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import NetInfo from '@react-native-community/netinfo';
import QRCode from 'react-native-qrcode-svg';

import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {authService, type RecoveryCodeRecord} from '../../../core/auth/AuthService';
import {AfriLinkError} from '../../../core/errors';

import {SixDigitCodeInput} from './components/SixDigitCodeInput';

export interface TotpSetupScreenProps {
  onComplete(): void;
}

export function TotpSetupScreen({onComplete}: TotpSetupScreenProps): React.JSX.Element {
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string>('');
  const [secret, setSecret] = React.useState('');
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [code, setCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [savedConfirmed, setSavedConfirmed] = React.useState(false);
  const [error, setError] = React.useState<AfriLinkError | null>(null);
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    let active = true;

    const startEnrollment = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const enrollment = await authService.enrollTotp();
        if (!active) {
          return;
        }

        setFactorId(enrollment.factorId);
        setQrCode(enrollment.qrCode);
        setSecret(enrollment.secret);
        setRecoveryCodes(enrollment.recoveryCode);
      } catch (enrollmentError) {
        if (!active) {
          return;
        }

        setError(
          enrollmentError instanceof AfriLinkError
            ? enrollmentError
            : new AfriLinkError('TOTP_INVALID', 'Unable to initialize TOTP setup.'),
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void startEnrollment();

    return () => {
      active = false;
    };
  }, []);

  const handleVerifyEnrollment = React.useCallback(async () => {
    if (!factorId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.verifyTotpEnrollment(code, factorId);
      const persisted = await authService.getRecoveryCodes();
      const values = persisted.map((entry: RecoveryCodeRecord) => entry.value);
      if (values.length > 0) {
        setRecoveryCodes(values);
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof AfriLinkError
          ? verifyError
          : new AfriLinkError('TOTP_INVALID', 'TOTP verification failed.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [code, factorId]);

  const copyRecoveryCodes = React.useCallback(() => {
    Clipboard.setString(recoveryCodes.join('\n'));
  }, [recoveryCodes]);

  return (
    <Screen avoidKeyboard scrollable>
      <View style={styles.container}>
        <Text style={styles.title}>Set up authenticator app</Text>

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Connect to continue.</Text>
          </View>
        ) : null}

        {qrCode ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Step 1: Scan QR code</Text>
            <View style={styles.qrContainer}>
              <QRCode value={qrCode} size={180} />
            </View>
            <Text style={styles.secretLabel}>Manual secret: {secret}</Text>
          </View>
        ) : null}

        <View style={styles.stepCard}>
          <Text style={styles.stepTitle}>Step 2: Confirm setup</Text>
          <SixDigitCodeInput
            value={code}
            onChange={setCode}
            editable={!isLoading}
            errorMessage={error?.message}
            testIDPrefix="totp-setup-cell"
          />
          <Button
            label="Verify setup"
            onPress={() => {
              void handleVerifyEnrollment();
            }}
            loading={isLoading}
            disabled={code.length < 6}
          />
        </View>

        {recoveryCodes.length > 0 ? (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Step 3: Save recovery codes</Text>
            <Text style={styles.warning}>These will not be shown again.</Text>

            <View style={styles.recoveryGrid}>
              {recoveryCodes.map(item => (
                <View key={item} style={styles.recoveryItem}>
                  <Text style={styles.recoveryText}>{item}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="copy-all-recovery-codes"
              onPress={copyRecoveryCodes}>
              <Text style={styles.linkText}>Copy all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="confirm-recovery-codes-saved"
              onPress={() => setSavedConfirmed(true)}>
              <Text style={styles.linkText}>I have saved these codes</Text>
            </TouchableOpacity>

            <Button
              label="Done"
              onPress={onComplete}
              disabled={!savedConfirmed}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: Spacing.base,
    gap: Spacing.base,
  },
  title: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  stepCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: 12,
    padding: Spacing.base,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  stepTitle: {
    ...TextPresets.body,
    color: Colors.neutral[900],
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secretLabel: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
  },
  warning: {
    ...TextPresets.caption,
    color: Colors.semantic.warning,
  },
  recoveryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  recoveryItem: {
    width: '48%',
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.neutral[50],
  },
  recoveryText: {
    ...TextPresets.caption,
    color: Colors.neutral[800],
  },
  linkText: {
    ...TextPresets.caption,
    color: Colors.brand[600],
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
});