import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';

/**
 * Call history screen — Phase 2 stub.
 * Will display a list of past calls (missed, incoming, outgoing) once
 * the CallManager persists call records to WatermelonDB.
 */
export function CallLogScreen(): React.JSX.Element {
  useScreenCaptureProtection(true);

  return (
    <View style={styles.container} testID="call-log-screen">
      <Text style={styles.title}>Calls</Text>
      <Text style={styles.body}>
        Your call history will appear here. Make a call to get started.
      </Text>
    </View>
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
  body: {
    ...TextPresets.body,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
});
