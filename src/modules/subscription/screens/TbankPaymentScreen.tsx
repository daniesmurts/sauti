/**
 * TbankPaymentScreen — full payment flow UI.
 *
 * Phases:
 *   form      → CardInputForm
 *   loading   → spinner text
 *   threeds   → ThreeDsWebView (v1 or v2.1)
 *   success   → confirmation + continue button
 *   error     → error message + retry button
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button, CardInputForm, Screen} from '../../../ui/components';
import {Colors, Spacing, TextPresets} from '../../../ui/tokens';
import {ThreeDsWebView} from './ThreeDsWebView';
import {readTbankEnv} from '../../../core/config/env';
import {TbankApiClient} from '../api/tbank/TbankApiClient';
import {
  TbankPaymentService,
  PlaintextCardDataEncryptor,
  type CardDetails,
  type TbankPaymentResult,
} from '../api/tbank/TbankPaymentService';

export interface TbankPaymentScreenProps {
  amountKopecks: number;
  orderId: string;
  description?: string;
  customerKey?: string;
  onSuccess(): void;
  onBack(): void;
  /** Override the encryptor — used in tests; production should inject RSA encryptor. */
  encryptor?: ConstructorParameters<typeof TbankPaymentService>[1];
}

type ScreenPhase =
  | {phase: 'form'; error?: string}
  | {phase: 'loading'}
  | {phase: 'threeds_v1'; paymentId: string; acsUrl: string; md: string; paReq: string}
  | {phase: 'threeds_v2'; paymentId: string; acsUrl: string; cReq: string}
  | {phase: 'success'}
  | {phase: 'error'; message: string};

export function TbankPaymentScreen({
  amountKopecks,
  orderId,
  description,
  customerKey,
  onSuccess,
  onBack,
  encryptor,
}: TbankPaymentScreenProps): React.JSX.Element {
  const [screenPhase, setPhase] = React.useState<ScreenPhase>({phase: 'form'});

  const service = React.useMemo(() => {
    const {terminalKey, terminalPassword} = readTbankEnv();
    const client = new TbankApiClient({terminalKey, password: terminalPassword});
    const enc = encryptor ?? new PlaintextCardDataEncryptor();
    return new TbankPaymentService(client, enc);
  }, [encryptor]);

  const handleResult = React.useCallback(
    (result: TbankPaymentResult) => {
      if (result.outcome === 'success') {
        setPhase({phase: 'success'});
      } else if (result.outcome === 'needs_3ds_v1') {
        setPhase({phase: 'threeds_v1', ...result});
      } else if (result.outcome === 'needs_3ds_v2') {
        setPhase({phase: 'threeds_v2', ...result});
      } else if (result.outcome === 'cancelled') {
        setPhase({phase: 'form', error: 'Payment was cancelled. Please try again.'});
      } else {
        setPhase({phase: 'error', message: result.message});
      }
    },
    [],
  );

  const handleCardSubmit = React.useCallback(
    async (card: CardDetails) => {
      setPhase({phase: 'loading'});
      const result = await service.initiatePayment({
        amountKopecks,
        orderId,
        description,
        customerKey,
        card,
      });
      handleResult(result);
    },
    [service, amountKopecks, orderId, description, customerKey, handleResult],
  );

  const handle3DSv1Complete = React.useCallback(
    async (paRes: string) => {
      if (screenPhase.phase !== 'threeds_v1') return;
      setPhase({phase: 'loading'});
      const result = await service.complete3DSv1(screenPhase.paymentId, screenPhase.md, paRes);
      handleResult(result);
    },
    [service, screenPhase, handleResult],
  );

  const handle3DSv2Complete = React.useCallback(
    async () => {
      if (screenPhase.phase !== 'threeds_v2') return;
      setPhase({phase: 'loading'});
      const result = await service.complete3DSv2(screenPhase.paymentId);
      handleResult(result);
    },
    [service, screenPhase, handleResult],
  );

  // ── Render phases ───────────────────────────────────────────────────────────

  if (screenPhase.phase === 'threeds_v1') {
    return (
      <ThreeDsWebView
        version="1.0"
        acsUrl={screenPhase.acsUrl}
        paReq={screenPhase.paReq}
        md={screenPhase.md}
        onComplete={handle3DSv1Complete}
        onCancel={() => setPhase({phase: 'form', error: '3DS verification cancelled.'})}
      />
    );
  }

  if (screenPhase.phase === 'threeds_v2') {
    return (
      <ThreeDsWebView
        version="2.1"
        acsUrl={screenPhase.acsUrl}
        cReq={screenPhase.cReq}
        onComplete={handle3DSv2Complete}
        onCancel={() => setPhase({phase: 'form', error: '3DS verification cancelled.'})}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.heading}>Subscribe to Sauti</Text>
        <Text style={styles.amount}>
          {(amountKopecks / 100).toFixed(2)} ₽
        </Text>

        {screenPhase.phase === 'success' ? (
          <View style={styles.feedback} testID="payment-success">
            <Text style={styles.successText}>Payment confirmed!</Text>
            <Button
              label="Continue"
              onPress={onSuccess}
              testID="payment-continue-button"
            />
          </View>
        ) : screenPhase.phase === 'error' ? (
          <View style={styles.feedback} testID="payment-error">
            <Text style={styles.errorText} testID="payment-error-message">
              {screenPhase.message}
            </Text>
            <Button
              label="Try again"
              variant="outline"
              onPress={() => setPhase({phase: 'form'})}
              testID="payment-retry-button"
            />
          </View>
        ) : (
          <CardInputForm
            onSubmit={card => void handleCardSubmit(card)}
            loading={screenPhase.phase === 'loading'}
            error={screenPhase.phase === 'form' ? screenPhase.error : undefined}
          />
        )}

        {screenPhase.phase !== 'success' && screenPhase.phase !== 'loading' ? (
          <Button
            label="Back"
            variant="ghost"
            size="sm"
            onPress={onBack}
            testID="payment-back-button"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  heading: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
    textAlign: 'center',
  },
  amount: {
    ...TextPresets.h1,
    color: Colors.brand[500],
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
  errorText: {
    ...TextPresets.body,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
});
