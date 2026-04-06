import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {StyleSheet, Text, View} from 'react-native';

import {MainFlowScreen} from '../modules/main';
import {SettingsSecurityScreen} from '../modules/settings';
import {Colors, Spacing, TextPresets} from '../ui/tokens';
import {useScreenCaptureProtection} from '../core/security/screenCaptureProtection';
import {
  getInitialPushNotificationRoomId,
  subscribeNotificationOpen,
} from '../core/notifications';
import {useAuthRedirect} from '../modules/auth/hooks/useAuthRedirect';

type RootTabParamList = {
  Chats: undefined;
  Calls: undefined;
  Contacts: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootTabParamList>();

interface PlaceholderTabScreenProps {
  title: string;
  detail: string;
  testID: string;
}

function PlaceholderTabScreen({
  title,
  detail,
  testID,
}: PlaceholderTabScreenProps): React.JSX.Element {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

function CallsTabScreen(): React.JSX.Element {
  useScreenCaptureProtection(true);

  return (
    <PlaceholderTabScreen
      title="Calls"
      detail="Call log and calling controls will be added in Phase 2."
      testID="tab-calls-screen"
    />
  );
}

function ContactsTabScreen(): React.JSX.Element {
  return (
    <PlaceholderTabScreen
      title="Contacts"
      detail="Contact search and invitation flows will be added next."
      testID="tab-contacts-screen"
    />
  );
}

function SettingsTabScreen(): React.JSX.Element {
  return <SettingsSecurityScreen />;
}

export function RootNavigator(): React.JSX.Element {
  const [pendingRoomId, setPendingRoomId] = React.useState<string | null>(null);

  useAuthRedirect({
    onMain: () => {
      // Already in the authenticated tree.
    },
    onEmailEntry: () => {
      // App shell handles switching back to auth gateway.
    },
    onTotpVerification: () => {
      // App shell handles switching back to auth gateway.
    },
  });

  React.useEffect(() => {
    // Handle notification tap when app was fully quit.
    void getInitialPushNotificationRoomId().then(roomId => {
      if (roomId) {
        setPendingRoomId(roomId);
        if (navigationRef.isReady()) {
          navigationRef.navigate('Chats');
        }
      }
    });

    // Handle notification tap when app was in background.
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

  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        initialRouteName="Chats"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.brand[600],
          tabBarInactiveTintColor: Colors.neutral[500],
        }}>
        <Tab.Screen name="Chats">
          {() => (
            <MainFlowScreen
              initialRoomId={pendingRoomId ?? undefined}
              onRoomOpened={() => setPendingRoomId(null)}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Calls" component={CallsTabScreen} />
        <Tab.Screen name="Contacts" component={ContactsTabScreen} />
        <Tab.Screen name="Settings" component={SettingsTabScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.neutral[0],
  },
  title: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  detail: {
    ...TextPresets.body,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
});
