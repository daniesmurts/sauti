import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {Button} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';

export interface UpgradePromptModalProps {
  visible: boolean;
  onUpgrade(): void;
  onDismiss(): void;
  /** The Matrix ID the user tried to message, shown in the body copy. */
  blockedTarget?: string;
}

export function UpgradePromptModal({
  visible,
  onUpgrade,
  onDismiss,
  blockedTarget,
}: UpgradePromptModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      testID="upgrade-prompt-modal">
      {/* Semi-transparent backdrop — tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Stop propagation so tapping the card doesn't dismiss */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Subscription required</Text>

          <Text style={styles.body}>
            {blockedTarget
              ? `Starting a conversation with ${blockedTarget} requires an active Sauti subscription.`
              : 'Starting a conversation with new contacts requires an active Sauti subscription.'}
            {'\n\n'}
            <Text style={styles.freeNote}>
              Receiving messages is always free.
            </Text>
          </Text>

          <View style={styles.actions}>
            <Button
              label="Subscribe now"
              onPress={onUpgrade}
              testID="upgrade-prompt-cta"
            />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onDismiss}
              style={styles.dismissButton}
              testID="upgrade-prompt-dismiss">
              <Text style={styles.dismissText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.neutral[0],
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.base,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.neutral[300],
    marginBottom: Spacing.sm,
  },
  title: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  body: {
    ...TextPresets.body,
    color: Colors.neutral[700],
    lineHeight: 22,
  },
  freeNote: {
    ...TextPresets.body,
    color: Colors.neutral[500],
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    ...TextPresets.label,
    color: Colors.neutral[600],
    fontWeight: '600',
  },
});
