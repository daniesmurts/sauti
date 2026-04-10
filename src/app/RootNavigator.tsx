import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {ContactsScreen, MainFlowScreen} from '../modules/main';
import {SettingsSecurityScreen} from '../modules/settings';
import {CallLogScreen, CallProvider} from '../modules/calling';
import {Colors} from '../ui/tokens';
import {useScreenCaptureProtection} from '../core/security/screenCaptureProtection';
import {
  getInitialPushNotificationRoomId,
  subscribeNotificationOpen,
} from '../core/notifications';
import {useAuthRedirect} from '../modules/auth/hooks/useAuthRedirect';
import {matrixClient} from '../core/matrix';
import {getCoreAppRuntime} from '../core/runtime';

type RootTabParamList = {
  Chats: undefined;
  Calls: undefined;
  Contacts: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootTabParamList>();

function getTabBarIconName(routeName: keyof RootTabParamList, focused: boolean): string {
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

function CallsTabScreen(): React.JSX.Element {
  return <CallLogScreen />;
}

function ContactsTabScreen(): React.JSX.Element {
  return <ContactsScreen />;
}

function SettingsTabScreen(): React.JSX.Element {
  return <SettingsSecurityScreen />;
}

export function RootNavigator(): React.JSX.Element {
  useScreenCaptureProtection(true);
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

  const localUserId = getCoreAppRuntime().getCurrentUserId();

  return (
    <CallProvider localUserId={localUserId} transport={matrixClient}>
      <NavigationContainer ref={navigationRef}>
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
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Calls" component={CallsTabScreen} />
          <Tab.Screen name="Contacts" component={ContactsTabScreen} />
          <Tab.Screen name="Settings" component={SettingsTabScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </CallProvider>
  );
}

