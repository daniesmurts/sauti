import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';

export interface AuthMethodChooserScreenProps {
  onChooseEmail(): void;
  onChoosePhone(): void;
}

export function AuthMethodChooserScreen({
  onChooseEmail,
  onChoosePhone,
}: AuthMethodChooserScreenProps): React.JSX.Element {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[TextPresets.h1, styles.brand]}>SAUTI</Text>
        <Text style={[TextPresets.body, styles.subtitle]}>
          Choose how you'd like to sign in
        </Text>

        <View style={styles.buttons}>
          <Button
            label="Continue with Email"
            variant="primary"
            accessibilityLabel="Continue with Email"
            onPress={onChooseEmail}
          />
          <Button
            label="Continue with Phone"
            variant="secondary"
            accessibilityLabel="Continue with Phone"
            onPress={onChoosePhone}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.base,
    paddingHorizontal: Spacing.lg,
  },
  brand: {
    color: Colors.brand.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.neutral[600],
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  buttons: {
    width: '100%',
    gap: Spacing.base,
  },
});
