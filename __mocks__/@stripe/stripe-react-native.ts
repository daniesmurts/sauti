/**
 * Jest manual mock for @stripe/stripe-react-native.
 */

export const useStripe = jest.fn(() => ({
  initPaymentSheet: jest.fn().mockResolvedValue({error: undefined}),
  presentPaymentSheet: jest.fn().mockResolvedValue({error: undefined}),
}));

export const StripeProvider = ({children}: {children: React.ReactNode}) => children;

// Re-export React so the JSX in StripeProvider compiles
import React from 'react';
void React;
