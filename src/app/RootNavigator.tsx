import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {StyleSheet, Text, View} from 'react-native';

import {MainFlowScreen} from '../modules/main';
import {Colors, Spacing, TextPresets} from '../ui/tokens';

type RootTabParamList = {
  Chats: undefined;
  Calls: undefined;
  Contacts: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

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
  return (
    <PlaceholderTabScreen
      title="Settings"
      detail="Security, proxy, and subscription settings will be expanded incrementally."
      testID="tab-settings-screen"
    />
  );
}

export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Chats"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.brand[600],
          tabBarInactiveTintColor: Colors.neutral[500],
        }}>
        <Tab.Screen name="Chats" component={MainFlowScreen} />
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
