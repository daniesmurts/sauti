import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

import {createAuthController, type AuthController} from '../controller';
import {type AuthStoreSnapshot} from '../store';

import {OTPVerificationScreen, type OTPSubmitPayload} from './OTPVerificationScreen';
import {PhoneEntryScreen} from './PhoneEntryScreen';
import {ProfileSetupScreen, type ProfileSetupPayload} from './ProfileSetupScreen';

type AuthFlowStep = 'phone_entry' | 'otp_verification' | 'profile_setup';

function buildRegistrationPassword(phoneNumber: string, otpCode: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  const phoneTail = digits.slice(-8) || '00000000';

  return `sauti-${phoneTail}-${otpCode}-v1`;
}

function buildInitialSnapshot(controller: AuthController): AuthStoreSnapshot {
  return controller.getSnapshot();
}

export interface AuthFlowScreenProps {
  controller?: AuthController;
}

export function AuthFlowScreen({controller}: AuthFlowScreenProps): React.JSX.Element {
  const resolvedController = React.useMemo(
    () => controller ?? createAuthController(),
    [controller],
  );

  const [snapshot, setSnapshot] = React.useState<AuthStoreSnapshot>(() =>
    buildInitialSnapshot(resolvedController),
  );
  const [step, setStep] = React.useState<AuthFlowStep>('phone_entry');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [pendingOtpCode, setPendingOtpCode] = React.useState('');

  React.useEffect(() => {
    return resolvedController.subscribe(setSnapshot);
  }, [resolvedController]);

  const handlePhoneContinue = React.useCallback((value: string) => {
    setPhoneNumber(value);
    setStep('otp_verification');
  }, []);

  const handleOtpSubmit = React.useCallback(({otpCode}: OTPSubmitPayload) => {
    setPendingOtpCode(otpCode);
    setStep('profile_setup');
  }, []);

  const handleProfileSubmit = React.useCallback(
    async ({displayName}: ProfileSetupPayload) => {
      await resolvedController.registerAndBootstrap({
        phoneNumber,
        otpCode: pendingOtpCode,
        password: buildRegistrationPassword(phoneNumber, pendingOtpCode),
        displayName,
      });
    },
    [pendingOtpCode, phoneNumber, resolvedController],
  );

  const isSubmitting = snapshot.status === 'registering';
  const remoteError = snapshot.status === 'error' ? snapshot.errorMessage : undefined;

  if (snapshot.status === 'ready') {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={[TextPresets.h2, styles.successTitle]}>Authentication Complete</Text>
          <Text style={[TextPresets.body, styles.successBody]}>
            Your session is active. Main app routing will be connected next.
          </Text>
          <Button label="Sign Out" variant="secondary" onPress={() => resolvedController.reset()} />
        </View>
      </Screen>
    );
  }

  if (step === 'phone_entry') {
    return <PhoneEntryScreen disabled={isSubmitting} onContinue={handlePhoneContinue} />;
  }

  if (step === 'otp_verification') {
    return (
      <OTPVerificationScreen
        phoneNumber={phoneNumber}
        loading={isSubmitting}
        errorMessage={remoteError}
        onBack={() => setStep('phone_entry')}
        onSubmit={handleOtpSubmit}
      />
    );
  }

  return (
    <ProfileSetupScreen
      loading={isSubmitting}
      onSubmit={payload => {
        void handleProfileSubmit(payload);
      }}
    />
  );
}

const styles = StyleSheet.create({
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.base,
  },
  successTitle: {
    color: Colors.semantic.success,
  },
  successBody: {
    color: Colors.neutral[700],
  },
});
