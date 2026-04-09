import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import {Button, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';
import {useAuthStore} from '../store/AuthStore';

import {SixDigitCodeInput} from './components/SixDigitCodeInput';

export interface OtpVerificationScreenProps {
  email: string;
  mode: 'signup' | 'signin';
  onVerified(hasTotpEnabled: boolean): void;
  onBack(): void;
}

const RESEND_TIMEOUT_SECONDS = 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected ?? true));
    });
    return () => unsubscribe();
  }, []);

  const isLoading = status === 'loading';

  // ── Dev bypass (DEV builds only) ──────────────────────────────────────────
  const [devCode, setDevCode] = React.useState('');
  const handleDevBypass = React.useCallback(async () => {
    if (!devCode.trim()) return;
    setCode(devCode.trim());
    await verifyOtp(devCode.trim());
    const snapshot = useAuthStore.getState();
    if (snapshot.status === 'authenticated' || snapshot.status === 'otp_sent') {
      onVerified(snapshot.hasTotpEnabled);
    }
  }, [devCode, onVerified, verifyOtp]);
  // ─────────────────────────────────────────────────────────────────────────

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
        {/* Brand mark */}
        <Text style={styles.brand}>SAUTI</Text>

        {/* Heading */}
        <Text style={styles.title}>Verify identity</Text>
        <Text style={styles.description}>
          We sent a 6-digit code to {email}. Paste it below to secure your hearth.
        </Text>

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>You are offline. Connect to continue.</Text>
          </View>
        ) : null}

        <SixDigitCodeInput
          value={code}
          onChange={value => {
            setCode(value);
            if (error) clearError();
          }}
          editable={!isLoading && !isOffline}
          errorMessage={error?.message}
        />

        {/* Resend row */}
        <View style={styles.resendRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="resend-otp"
            disabled={secondsRemaining > 0 || isLoading || isOffline}
            onPress={() => {
              void sendOtp(email, mode === 'signup');
              setSecondsRemaining(RESEND_TIMEOUT_SECONDS);
              setCode('');
            }}>
            <Text style={[styles.resendLabel, secondsRemaining > 0 && styles.resendDisabled]}>
              RESEND CODE
            </Text>
          </TouchableOpacity>
          {secondsRemaining > 0 ? (
            <Text style={styles.resendTimer}>AVAILABLE IN {formatTime(secondsRemaining)}</Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="Verify"
            size="lg"
            onPress={() => { void submitCode(); }}
            loading={isLoading}
            disabled={code.length < 6 || isOffline}
          />
          <Button label="Back" variant="ghost" onPress={onBack} disabled={isLoading} />
        </View>

        {/* Security indicator */}
        <View style={styles.securityBadge}>
          <View style={styles.securityDot} />
          <Text style={styles.securityText}>SECURE TUNNEL: ACTIVE</Text>
        </View>

        {/* DEV bypass */}
        {__DEV__ ? (
          <View style={styles.devSection}>
            <Text style={styles.devLabel}>Dev bypass — paste OTP from Supabase Auth logs</Text>
            <View style={styles.devRow}>
              <TextInputShim
                value={devCode}
                onChangeText={setDevCode}
                placeholder="000000"
                style={styles.devInput}
              />
              <TouchableOpacity
                style={styles.devButton}
                onPress={() => { void handleDevBypass(); }}>
                <Text style={styles.devButtonText}>Go</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

// Minimal shim so we can use TextInput in JSX without a separate import cluttering the main screen
import {TextInput as TextInputShim} from 'react-native';

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
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral[900],
    lineHeight: 34,
  },
  description: {
    ...TextPresets.body,
    color: Colors.neutral[600],
  },
  offlineBanner: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.semantic.warning,
    backgroundColor: Colors.semantic.warningBg,
    padding: Spacing.sm,
  },
  offlineText: {
    ...TextPresets.caption,
    color: Colors.semantic.warning,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  resendLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.brand[500],
  },
  resendDisabled: {
    color: Colors.neutral[400],
  },
  resendTimer: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.neutral[500],
  },
  actions: {
    gap: Spacing.sm,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
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
  devSection: {
    marginTop: Spacing.xl,
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    backgroundColor: Colors.neutral[100],
  },
  devLabel: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
  },
  devRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  devInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    borderColor: Colors.neutral[300],
    paddingHorizontal: Spacing.sm,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[0],
    fontSize: 16,
    letterSpacing: 4,
  },
  devButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    justifyContent: 'center',
    backgroundColor: Colors.neutral[800],
  },
  devButtonText: {
    ...TextPresets.label,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
});
