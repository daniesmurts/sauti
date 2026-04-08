/**
 * IncomingCallScreen — full-screen foreground overlay shown when an encrypted
 * call arrives while the app is in the foreground.
 *
 * Lock-screen / background presentation is handled by react-native-callkeep
 * (CallKeepService). This screen covers the in-app case.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';

export interface IncomingCallScreenProps {
  callerId: string;
  onAnswer(): void;
  onReject(): void;
}

export function IncomingCallScreen({
  callerId,
  onAnswer,
  onReject,
}: IncomingCallScreenProps): React.JSX.Element {
  useScreenCaptureProtection(true);

  // Pulse animation on the answer button to draw attention
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const callerInitial = callerId.slice(1, 2).toUpperCase() || '?';

  return (
    <View style={styles.container} testID="incoming-call-screen">
      {/* Caller avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial} testID="caller-initial">
            {callerInitial}
          </Text>
        </View>
        <Text style={styles.callerLabel} testID="incoming-call-caller-id" numberOfLines={1}>
          {callerId}
        </Text>
        <Text style={styles.subtitleLabel}>Encrypted call</Text>
      </View>

      {/* Action row */}
      <View style={styles.actionsRow}>
        {/* Reject */}
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          accessibilityRole="button"
          accessibilityLabel="Reject call"
          onPress={onReject}
          testID="reject-call-button">
          <Text style={styles.actionIcon}>✕</Text>
          <Text style={styles.actionLabel}>Decline</Text>
        </TouchableOpacity>

        {/* Answer */}
        <Animated.View style={[styles.answerButtonWrapper, {transform: [{scale: pulse}]}]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.answerButton]}
            accessibilityRole="button"
            accessibilityLabel="Answer call"
            onPress={onAnswer}
            testID="answer-call-button">
            <Text style={styles.actionIcon}>✓</Text>
            <Text style={styles.actionLabel}>Answer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.neutral[900],
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: Spacing.xl * 2,
    zIndex: 999,
  },
  avatarContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.brand[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  callerLabel: {
    ...TextPresets.h2,
    color: Colors.neutral[0],
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  subtitleLabel: {
    ...TextPresets.body,
    color: Colors.neutral[400],
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl * 2,
  },
  answerButtonWrapper: {},
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  rejectButton: {
    backgroundColor: Colors.semantic.error,
  },
  answerButton: {
    backgroundColor: Colors.semantic.success,
  },
  actionIcon: {
    fontSize: 28,
    color: Colors.neutral[0],
    fontWeight: '700',
  },
  actionLabel: {
    ...TextPresets.caption,
    color: Colors.neutral[0],
  },
});
