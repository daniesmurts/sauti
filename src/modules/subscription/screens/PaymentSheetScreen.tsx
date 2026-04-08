/**
 * PaymentSheetScreen — "Subscribe" entry point for the Stripe payment flow.
 *
 * States:
 *  idle      → shows Subscribe button
 *  loading   → spinner while creating payment intent / presenting sheet
 *  success   → confirmation message + continue button
 *  cancelled → soft message, user can retry
 *  error     → error text + retry button
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useStripe} from '@stripe/stripe-react-native';
import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {StripePaymentService} from '../api/StripePaymentService';

export interface PaymentSheetScreenProps {
  matrixUserId: string;
  onSuccess(): void;
  onBack(): void;
}

type ScreenState =
  | {phase: 'idle'}
  | {phase: 'loading'}
  | {phase: 'success'}
  | {phase: 'cancelled'}
  | {phase: 'error'; message: string};

export function PaymentSheetScreen({
  matrixUserId,
  onSuccess,
  onBack,
}: PaymentSheetScreenProps): React.JSX.Element {
  const stripe = useStripe();
  const [state, setState] = React.useState<ScreenState>({phase: 'idle'});

  const service = React.useMemo(
    () => new StripePaymentService(stripe),
    [stripe],
  );

  const handleSubscribe = React.useCallback(async () => {
    setState({phase: 'loading'});
    const result = await service.pay(matrixUserId);

    if (result.outcome === 'success') {
      setState({phase: 'success'});
    } else if (result.outcome === 'cancelled') {
      setState({phase: 'cancelled'});
    } else {
      setState({phase: 'error', message: result.message});
    }
  }, [service, matrixUserId]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.heading} testID="payment-heading">
          Sauti Subscription
        </Text>
        <Text style={styles.body}>
          One subscription covers you and all your contacts.
        </Text>

        {state.phase === 'success' ? (
          <View style={styles.feedback} testID="payment-success">
            <Text style={styles.successText}>Payment successful!</Text>
            <Button label="Continue" onPress={onSuccess} testID="payment-continue-button" />
          </View>
        ) : state.phase === 'cancelled' ? (
          <View style={styles.feedback} testID="payment-cancelled">
            <Text style={styles.cancelledText}>Payment cancelled.</Text>
            <Button
              label="Try again"
              variant="outline"
              onPress={() => setState({phase: 'idle'})}
              testID="payment-retry-button"
            />
          </View>
        ) : state.phase === 'error' ? (
          <View style={styles.feedback} testID="payment-error">
            <Text style={styles.errorText} testID="payment-error-message">
              {state.message}
            </Text>
            <Button
              label="Retry"
              variant="outline"
              onPress={() => setState({phase: 'idle'})}
              testID="payment-retry-button"
            />
          </View>
        ) : (
          <View style={styles.feedback}>
            <Button
              label={state.phase === 'loading' ? 'Processing…' : 'Subscribe'}
              disabled={state.phase === 'loading'}
              onPress={() => void handleSubscribe()}
              testID="payment-subscribe-button"
            />
          </View>
        )}

        <Button
          label="Back"
          variant="ghost"
          size="sm"
          onPress={onBack}
          testID="payment-back-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
    justifyContent: 'center',
  },
  heading: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
    textAlign: 'center',
  },
  body: {
    ...TextPresets.body,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  feedback: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  successText: {
    ...TextPresets.body,
    color: Colors.semantic.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelledText: {
    ...TextPresets.body,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
  errorText: {
    ...TextPresets.body,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
});
