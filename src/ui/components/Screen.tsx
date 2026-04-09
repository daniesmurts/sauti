import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import {Colors} from '../tokens/colors';
import {Spacing} from '../tokens/spacing';

export interface ScreenProps {
  children: React.ReactNode;
  /**
   * When true, wraps content in a ScrollView so the screen is
   * scrollable (e.g. auth forms). Default: false.
   */
  scrollable?: boolean;
  /**
   * When true, wraps content in a KeyboardAvoidingView so the
   * keyboard lifts the content on iOS/Android. Default: false.
   */
  avoidKeyboard?: boolean;
  /**
   * Use the dark warm-brown background for main app screens
   * (chat list, chat room, etc.). Default: false (cream/light).
   */
  dark?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Screen({
  children,
  scrollable = false,
  avoidKeyboard = false,
  dark = false,
  style,
  testID,
}: ScreenProps): React.JSX.Element {
  const inner = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    children
  );

  const body = avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.root, dark && styles.rootDark, style]}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: Spacing.base,
  },
  rootDark: {
    backgroundColor: Colors.neutral[900],
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing['2xl'],
  },
});
