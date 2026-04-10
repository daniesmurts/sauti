import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {AuthMethodChooserScreen} from '../modules/auth/screens/AuthMethodChooserScreen';
import {AuthFlowScreen} from '../modules/auth/screens/AuthFlowScreen';
import {EmailEntryScreen} from '../modules/auth/screens/EmailEntryScreen';
import {OtpVerificationScreen} from '../modules/auth/screens/OTPVerificationScreen';
import {TotpSetupScreen} from '../modules/auth/screens/TotpSetupScreen';
import {TotpVerificationScreen} from '../modules/auth/screens/TotpVerificationScreen';
import {useAuthRedirect} from '../modules/auth/hooks/useAuthRedirect';

import {ContactsScreen, MainFlowScreen} from '../modules/main';
import {SettingsSecurityScreen} from '../modules/settings';
import {CallLogScreen, CallProvider} from '../modules/calling';
import {Colors} from '../ui/tokens';
import {useScreenCaptureProtection} from '../core/security/screenCaptureProtection';
import {
  getInitialPushNotificationRoomId,
  subscribeNotificationOpen,
} from '../core/notifications';
import {matrixClient} from '../core/matrix';
import {getCoreAppRuntime} from '../core/runtime';

// ── Type declarations ─────────────────────────────────────────────────────────

type AuthStackParamList = {
  AuthMethodChooser: undefined;
  EmailEntry: undefined;
  OtpVerification: {email: string; mode: 'signup' | 'signin'};
  TotpVerification: undefined;
  TotpSetup: undefined;
  PhoneAuth: undefined;
};

type MainTabParamList = {
  Chats: undefined;
  Calls: undefined;
  Contacts: undefined;
  Settings: undefined;
};

// ── Navigators ────────────────────────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
export const navigationRef = createNavigationContainerRef<MainTabParamList>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTabBarIconName(routeName: keyof MainTabParamList, focused: boolean): string {
  switch (routeName) {
    case 'Chats':
      return focused ? 'chat' : 'chat-outline';
    case 'Calls':
      return focused ? 'phone' : 'phone-outline';
    case 'Contacts':
      return focused ? 'account-group' : 'account-group-outline';
    case 'Settings':
      return focused ? 'cog' : 'cog-outline';
    default:
      return 'circle-outline';
  }
}

// ── Auth initial session check ────────────────────────────────────────────────
// Runs once when the auth stack mounts to redirect already-authenticated users.

function AuthSessionCheck({
  onAuthenticated,
  navigateTotp,
}: {
  onAuthenticated(): void;
  navigateTotp(): void;
}): null {
  useAuthRedirect({
    onMain: onAuthenticated,
    onEmailEntry: () => {
      // Already on the chooser — no navigation needed.
    },
    onTotpVerification: navigateTotp,
  });

  return null;
}

// ── Main tab navigator ────────────────────────────────────────────────────────

function MainTabNavigator(): React.JSX.Element {
  useScreenCaptureProtection(true);
  const [pendingRoomId, setPendingRoomId] = React.useState<string | null>(null);
  const [pendingStartInput, setPendingStartInput] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getInitialPushNotificationRoomId().then(roomId => {
      if (roomId) {
        setPendingRoomId(roomId);
        if (navigationRef.isReady()) {
          navigationRef.navigate('Chats');
        }
      }
    });

    const unsubscribe = subscribeNotificationOpen(roomId => {
      setPendingRoomId(roomId);
      if (navigationRef.isReady()) {
        navigationRef.navigate('Chats');
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const localUserId = getCoreAppRuntime().getCurrentUserId();

  return (
    <CallProvider localUserId={localUserId} transport={matrixClient}>
      <Tab.Navigator
        initialRouteName="Chats"
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarActiveTintColor: Colors.brand[600],
          tabBarInactiveTintColor: Colors.neutral[500],
          tabBarIcon: ({focused, color, size}) => (
            <MaterialCommunityIcons
              name={getTabBarIconName(route.name, focused)}
              size={size}
              color={color}
            />
          ),
        })}>
        <Tab.Screen name="Chats">
          {() => (
            <MainFlowScreen
              initialRoomId={pendingRoomId ?? undefined}
              onRoomOpened={() => setPendingRoomId(null)}
              initialStartInput={pendingStartInput ?? undefined}
              onStartInputHandled={() => setPendingStartInput(null)}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Calls" component={CallLogScreen} />
        <Tab.Screen name="Contacts">
          {() => (
            <ContactsScreen
              onStartChat={chatInput => {
                setPendingStartInput(chatInput);
                if (navigationRef.isReady()) {
                  navigationRef.navigate('Chats');
                }
              }}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Settings" component={SettingsSecurityScreen} />
      </Tab.Navigator>
    </CallProvider>
  );
}

// ── Auth stack navigator ──────────────────────────────────────────────────────

function AuthStackNavigator({
  onAuthenticated,
}: {
  onAuthenticated(): void;
}): React.JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{headerShown: false}}>
      <AuthStack.Screen name="AuthMethodChooser">
        {({navigation}) => (
          <>
            <AuthSessionCheck
              onAuthenticated={onAuthenticated}
              navigateTotp={() => navigation.navigate('TotpVerification')}
            />
            <AuthMethodChooserScreen
              onChooseEmail={() => navigation.navigate('EmailEntry')}
              onChoosePhone={() => navigation.navigate('PhoneAuth')}
            />
          </>
        )}
      </AuthStack.Screen>

      <AuthStack.Screen name="EmailEntry">
        {({navigation}) => (
          <EmailEntryScreen
            onOtpSent={(email, mode) => {
              navigation.navigate('OtpVerification', {email, mode});
            }}
          />
        )}
      </AuthStack.Screen>

      <AuthStack.Screen name="OtpVerification">
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
              onAuthenticated();
            }}
          />
        )}
      </AuthStack.Screen>

      <AuthStack.Screen name="TotpVerification">
        {() => <TotpVerificationScreen onSuccess={onAuthenticated} />}
      </AuthStack.Screen>

      <AuthStack.Screen name="TotpSetup">
        {({navigation}) => (
          <TotpSetupScreen onComplete={() => navigation.goBack()} />
        )}
      </AuthStack.Screen>

      <AuthStack.Screen name="PhoneAuth">
        {() => <AuthFlowScreen onAuthenticated={onAuthenticated} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface AppNavigatorProps {
  isAuthenticated: boolean;
  onAuthenticated(): void;
}

/**
 * Single-container navigation root.
 * Renders the auth stack when unauthenticated and the main tab navigator
 * when authenticated. Sharing one NavigationContainer avoids the
 * unmount/remount flash that occurred with the two-container split.
 */
export function AppNavigator({
  isAuthenticated,
  onAuthenticated,
}: AppNavigatorProps): React.JSX.Element {
  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? (
        <MainTabNavigator />
      ) : (
        <AuthStackNavigator onAuthenticated={onAuthenticated} />
      )}
    </NavigationContainer>
  );
}
