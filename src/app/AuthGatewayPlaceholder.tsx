import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';

import {useAuthRedirect} from '../modules/auth/hooks/useAuthRedirect';
import {EmailEntryScreen} from '../modules/auth/screens/EmailEntryScreen';
import {OtpVerificationScreen} from '../modules/auth/screens/OTPVerificationScreen';
import {TotpSetupScreen} from '../modules/auth/screens/TotpSetupScreen';
import {TotpVerificationScreen} from '../modules/auth/screens/TotpVerificationScreen';

type AuthStackParamList = {
  EmailEntry: undefined;
  OtpVerification: {email: string; mode: 'signup' | 'signin'};
  TotpVerification: undefined;
  TotpSetup: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Entry point for email OTP and optional TOTP auth flow.
 */
export interface AuthGatewayPlaceholderProps {
  onAuthenticated?(): void;
}

function AuthInitialRedirect({
  onAuthenticated,
  navigateEmail,
  navigateTotp,
}: {
  onAuthenticated?: () => void;
  navigateEmail: () => void;
  navigateTotp: () => void;
}): null {
  useAuthRedirect({
    onMain: () => {
      onAuthenticated?.();
    },
    onEmailEntry: navigateEmail,
    onTotpVerification: navigateTotp,
  });

  return null;
}

export function AuthGatewayPlaceholder({
  onAuthenticated,
}: AuthGatewayPlaceholderProps): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="EmailEntry">
          {({navigation}) => (
            <>
              <AuthInitialRedirect
                onAuthenticated={onAuthenticated}
                navigateEmail={() => navigation.navigate('EmailEntry')}
                navigateTotp={() => navigation.navigate('TotpVerification')}
              />
              <EmailEntryScreen
                onOtpSent={(email, mode) => {
                  navigation.navigate('OtpVerification', {email, mode});
                }}
              />
            </>
          )}
        </Stack.Screen>
        <Stack.Screen name="OtpVerification">
          {({route, navigation}) => (
            <OtpVerificationScreen
              email={route.params.email}
              mode={route.params.mode}
              onBack={() => navigation.goBack()}
              onVerified={hasTotpEnabled => {
                if (hasTotpEnabled) {
                  navigation.replace('TotpVerification');
                  return;
                }

                onAuthenticated?.();
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TotpVerification">
          {() => <TotpVerificationScreen onSuccess={() => onAuthenticated?.()} />}
        </Stack.Screen>
        <Stack.Screen name="TotpSetup">
          {({navigation}) => (
            <TotpSetupScreen
              onComplete={() => {
                navigation.goBack();
              }}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
