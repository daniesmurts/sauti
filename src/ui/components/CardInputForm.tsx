/**
 * CardInputForm — native card data entry component.
 *
 * Fields: PAN (formatted 4-4-4-4), expiry (MM/YY auto-slash), CVV, cardholder name.
 * Validation runs on submit only.
 */

import React from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import type {CardDetails} from '../../modules/subscription/api/tbank/TbankPaymentService';
import {Button} from './Button';
import {Colors, Radius, Spacing, TextPresets} from '../tokens';

export interface CardInputFormProps {
  onSubmit(card: CardDetails): void;
  loading?: boolean;
  error?: string;
}

export function CardInputForm({onSubmit, loading, error}: CardInputFormProps): React.JSX.Element {
  const [pan, setPan] = React.useState('');
  const [expiry, setExpiry] = React.useState('');
  const [cvv, setCvv] = React.useState('');
  const [cardHolder, setCardHolder] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const handlePanChange = React.useCallback((value: string) => {
    // Allow only digits, format as XXXX XXXX XXXX XXXX
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.match(/.{1,4}/g)?.join(' ') ?? digits;
    setPan(formatted);
  }, []);

  const handleExpiryChange = React.useCallback((value: string) => {
    // Format as MM/YY
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setExpiry(digits);
    }
  }, []);

  const handleSubmit = React.useCallback(() => {
    const panDigits = pan.replace(/\s/g, '');
    if (panDigits.length < 13) {
      setValidationError('Enter a valid card number.');
      return;
    }
    const expiryDigits = expiry.replace('/', '');
    if (expiryDigits.length !== 4) {
      setValidationError('Enter expiry as MM/YY.');
      return;
    }
    if (cvv.length < 3) {
      setValidationError('Enter a valid CVV.');
      return;
    }
    setValidationError(null);
    onSubmit({
      pan: panDigits,
      expDate: `${expiryDigits.slice(0, 2)}${expiryDigits.slice(2)}`, // MMYY
      cvv,
      cardHolder: cardHolder.toUpperCase(),
    });
  }, [pan, expiry, cvv, cardHolder, onSubmit]);

  const displayError = validationError ?? error;

  return (
    <View style={styles.container} testID="card-input-form">
      <Text style={styles.label}>Card number</Text>
      <TextInput
        style={styles.input}
        value={pan}
        onChangeText={handlePanChange}
        placeholder="0000 0000 0000 0000"
        placeholderTextColor={Colors.neutral[400]}
        keyboardType="numeric"
        maxLength={19}
        accessibilityLabel="Card number"
        testID="card-pan-input"
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Expiry</Text>
          <TextInput
            style={styles.input}
            value={expiry}
            onChangeText={handleExpiryChange}
            placeholder="MM/YY"
            placeholderTextColor={Colors.neutral[400]}
            keyboardType="numeric"
            maxLength={5}
            accessibilityLabel="Expiry date"
            testID="card-expiry-input"
          />
        </View>

        <View style={styles.halfField}>
          <Text style={styles.label}>CVV</Text>
          <TextInput
            style={styles.input}
            value={cvv}
            onChangeText={v => setCvv(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="•••"
            placeholderTextColor={Colors.neutral[400]}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            accessibilityLabel="CVV"
            testID="card-cvv-input"
          />
        </View>
      </View>

      <Text style={styles.label}>Cardholder name</Text>
      <TextInput
        style={styles.input}
        value={cardHolder}
        onChangeText={setCardHolder}
        placeholder="IVAN PETROV"
        placeholderTextColor={Colors.neutral[400]}
        autoCapitalize="characters"
        maxLength={26}
        accessibilityLabel="Cardholder name"
        testID="card-holder-input"
      />

      {displayError ? (
        <Text style={styles.error} testID="card-form-error">{displayError}</Text>
      ) : null}

      <Button
        label={loading ? 'Processing…' : 'Pay'}
        disabled={loading}
        onPress={handleSubmit}
        testID="card-pay-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: Spacing.sm},
  label: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
    marginBottom: -Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[0],
    ...TextPresets.body,
  },
  row: {flexDirection: 'row', gap: Spacing.sm},
  halfField: {flex: 1, gap: Spacing.xs},
  error: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
});
