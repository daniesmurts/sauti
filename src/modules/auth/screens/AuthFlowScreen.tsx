import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

import {OtpAuthService, type RequestOtpResult} from '../api';
import {createAuthController, type AuthController} from '../controller';
import {type AuthStoreSnapshot} from '../store';

import {PhoneOTPVerificationScreen as OTPVerificationScreen, type OTPSubmitPayload} from './PhoneOTPVerificationScreen';
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
  otpService?: Pick<OtpAuthService, 'requestOtp' | 'verifyOtp'>;
}

export function AuthFlowScreen({
  controller,
  otpService,
}: AuthFlowScreenProps): React.JSX.Element {
  const resolvedController = React.useMemo(
    () => controller ?? createAuthController(),
    [controller],
  );
  const resolvedOtpService = React.useMemo(
    () => otpService ?? new OtpAuthService(),
    [otpService],
  );

  const [snapshot, setSnapshot] = React.useState<AuthStoreSnapshot>(() =>
    buildInitialSnapshot(resolvedController),
  );
  const [step, setStep] = React.useState<AuthFlowStep>('phone_entry');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [pendingOtpCode, setPendingOtpCode] = React.useState('');
  const [otpRequest, setOtpRequest] = React.useState<RequestOtpResult | null>(null);
  const [otpErrorMessage, setOtpErrorMessage] = React.useState<string | undefined>();
  const [flowStatus, setFlowStatus] = React.useState<'idle' | 'requesting_otp' | 'verifying_otp'>('idle');

  React.useEffect(() => {
    return resolvedController.subscribe(setSnapshot);
  }, [resolvedController]);

  const handlePhoneContinue = React.useCallback(
    async (value: string) => {
      setFlowStatus('requesting_otp');
      setOtpErrorMessage(undefined);

      try {
        const request = await resolvedOtpService.requestOtp({phoneNumber: value});

        setPhoneNumber(value);
        setOtpRequest(request);
        setStep('otp_verification');
      } catch (error) {
        setOtpErrorMessage(
          error instanceof Error ? error.message : 'Unable to request OTP code.',
        );
      } finally {
        setFlowStatus('idle');
      }
    },
    [resolvedOtpService],
  );

  const handleOtpSubmit = React.useCallback(
    async ({otpCode}: OTPSubmitPayload) => {
      setFlowStatus('verifying_otp');
      setOtpErrorMessage(undefined);

      try {
        await resolvedOtpService.verifyOtp({
          phoneNumber,
          otpCode,
          requestId: otpRequest?.requestId,
        });

        setPendingOtpCode(otpCode);
        setStep('profile_setup');
      } catch (error) {
        setOtpErrorMessage(
          error instanceof Error ? error.message : 'Unable to verify OTP code.',
        );
      } finally {
        setFlowStatus('idle');
      }
    },
    [otpRequest?.requestId, phoneNumber, resolvedOtpService],
  );

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

  const isRegistering = snapshot.status === 'registering';
  const remoteError = snapshot.status === 'error' ? snapshot.errorMessage : undefined;
  const phoneStepError = step === 'phone_entry' ? otpErrorMessage : undefined;
  const otpStepError = step === 'otp_verification' ? otpErrorMessage ?? remoteError : remoteError;

  if (snapshot.status === 'ready') {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={[TextPresets.h2, styles.successTitle]}>Authentication Complete</Text>
          <Text style={[TextPresets.body, styles.successBody]}>
            Your session is active and the app is ready to continue.
          </Text>
          <Button label="Sign Out" variant="secondary" onPress={() => resolvedController.reset()} />
        </View>
      </Screen>
    );
  }

  if (step === 'phone_entry') {
    return (
      <PhoneEntryScreen
        disabled={flowStatus === 'requesting_otp' || isRegistering}
        errorMessage={phoneStepError}
        onContinue={value => {
          void handlePhoneContinue(value);
        }}
      />
    );
  }

  if (step === 'otp_verification') {
    return (
      <OTPVerificationScreen
        phoneNumber={phoneNumber}
        loading={flowStatus === 'verifying_otp' || isRegistering}
        errorMessage={otpStepError}
        onBack={() => setStep('phone_entry')}
        onSubmit={payload => {
          void handleOtpSubmit(payload);
        }}
      />
    );
  }

  return (
    <ProfileSetupScreen
      loading={isRegistering}
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
