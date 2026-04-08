/**
 * Stripe payment integration tests.
 *
 * Covers:
 *  - StripePaymentService: success, cancellation, init error, present error,
 *    network failure creating payment intent
 *  - PaymentSheetScreen: idle render, loading state, success state,
 *    cancelled state, error state with retry
 *  - stripe-webhook handler: payment_intent.succeeded, subscription.deleted,
 *    invoice.payment_failed, invalid signature
 */

import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest, beforeEach} from '@jest/globals';

import {useStripe} from '@stripe/stripe-react-native';
import {StripePaymentService} from '../src/modules/subscription/api/StripePaymentService';
import {PaymentSheetScreen} from '../src/modules/subscription/screens/PaymentSheetScreen';
import {createStripeWebhookHandler} from '../supabase/functions/stripe-webhook/handler';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findByTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(n => n.props.testID === id)[0] ?? null;
}

const SETUP_PAYLOAD = {
  clientSecret: 'pi_test_secret',
  ephemeralKey: 'ek_test',
  customerId: 'cus_test',
  publishableKey: 'pk_test',
};

function makeFetch(overrides?: {status?: number; body?: object}) {
  return jest.fn().mockResolvedValue({
    ok: overrides?.status === undefined ? true : (overrides.status ?? 200) < 400,
    status: overrides?.status ?? 200,
    json: () => Promise.resolve(overrides?.body ?? SETUP_PAYLOAD),
  });
}

function makeStripe(overrides?: {
  initError?: string;
  presentError?: string | null;
  presentCancelled?: boolean;
}) {
  return {
    initPaymentSheet: jest.fn().mockResolvedValue({
      error: overrides?.initError ? {message: overrides.initError} : null,
    }),
    presentPaymentSheet: jest.fn().mockResolvedValue({
      error: overrides?.presentCancelled
        ? {message: 'Canceled', code: 'Canceled'}
        : overrides?.presentError
        ? {message: overrides.presentError}
        : null,
    }),
  };
}

// ── StripePaymentService ──────────────────────────────────────────────────────

describe('StripePaymentService', () => {
  beforeEach(() => {
    jest.spyOn(require('../src/core/config/env'), 'readSupabaseEnv').mockReturnValue({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('returns success when payment sheet completes', async () => {
    const service = new StripePaymentService(makeStripe(), makeFetch());
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('success');
  });

  it('returns cancelled when user cancels payment sheet', async () => {
    const service = new StripePaymentService(
      makeStripe({presentCancelled: true}),
      makeFetch(),
    );
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('cancelled');
  });

  it('returns error when initPaymentSheet fails', async () => {
    const service = new StripePaymentService(
      makeStripe({initError: 'Init failed'}),
      makeFetch(),
    );
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('error');
    expect((result as {outcome: 'error'; message: string}).message).toBe('Init failed');
  });

  it('returns error when presentPaymentSheet fails', async () => {
    const service = new StripePaymentService(
      makeStripe({presentError: 'Card declined'}),
      makeFetch(),
    );
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('error');
    expect((result as {outcome: 'error'; message: string}).message).toBe('Card declined');
  });

  it('returns error when create-payment-intent returns non-ok', async () => {
    const service = new StripePaymentService(makeStripe(), makeFetch({status: 500}));
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('error');
  });

  it('returns error when fetch throws (network failure)', async () => {
    const failFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const service = new StripePaymentService(makeStripe(), failFetch as typeof fetch);
    const result = await service.pay('@user:sauti.test');
    expect(result.outcome).toBe('error');
    expect((result as {outcome: 'error'; message: string}).message).toBe('Network error');
  });
});

// ── PaymentSheetScreen ────────────────────────────────────────────────────────

describe('PaymentSheetScreen', () => {
  const mockOnSuccess = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    mockOnSuccess.mockClear();
    mockOnBack.mockClear();
    jest.spyOn(require('../src/core/config/env'), 'readSupabaseEnv').mockReturnValue({
      supabaseUrl: 'https://test.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('renders subscribe button in idle state', () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );
    expect(findByTestID(tree, 'payment-subscribe-button')).not.toBeNull();
    expect(findByTestID(tree, 'payment-success')).toBeNull();
    expect(findByTestID(tree, 'payment-error')).toBeNull();
  });

  it('shows success state after successful payment', async () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    // Override service fetch inside useMemo — inject via module mock
    jest
      .spyOn(StripePaymentService.prototype, 'pay')
      .mockResolvedValueOnce({outcome: 'success'});

    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'payment-subscribe-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'payment-success')).not.toBeNull();
    expect(findByTestID(tree, 'payment-subscribe-button')).toBeNull();

    jest.restoreAllMocks();
  });

  it('calls onSuccess when continue button pressed after success', async () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    jest
      .spyOn(StripePaymentService.prototype, 'pay')
      .mockResolvedValueOnce({outcome: 'success'});

    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'payment-subscribe-button')?.props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findByTestID(tree, 'payment-continue-button')?.props.onPress();
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it('shows cancelled state and retry button after cancellation', async () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    jest
      .spyOn(StripePaymentService.prototype, 'pay')
      .mockResolvedValueOnce({outcome: 'cancelled'});

    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'payment-subscribe-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'payment-cancelled')).not.toBeNull();
    expect(findByTestID(tree, 'payment-retry-button')).not.toBeNull();
    jest.restoreAllMocks();
  });

  it('shows error message and retry button on failure', async () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    jest
      .spyOn(StripePaymentService.prototype, 'pay')
      .mockResolvedValueOnce({outcome: 'error', message: 'Card declined'});

    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'payment-subscribe-button')?.props.onPress();
      await Promise.resolve();
    });

    expect(findByTestID(tree, 'payment-error')).not.toBeNull();
    expect(findByTestID(tree, 'payment-error-message')?.props.children).toBe('Card declined');
    jest.restoreAllMocks();
  });

  it('returns to idle state when retry is pressed', async () => {
    (useStripe as jest.Mock).mockReturnValue(makeStripe());
    jest
      .spyOn(StripePaymentService.prototype, 'pay')
      .mockResolvedValueOnce({outcome: 'error', message: 'Declined'});

    const tree = renderer.create(
      <PaymentSheetScreen
        matrixUserId="@user:sauti.test"
        onSuccess={mockOnSuccess}
        onBack={mockOnBack}
      />,
    );

    await act(async () => {
      findByTestID(tree, 'payment-subscribe-button')?.props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findByTestID(tree, 'payment-retry-button')?.props.onPress();
    });

    expect(findByTestID(tree, 'payment-subscribe-button')).not.toBeNull();
    jest.restoreAllMocks();
  });
});

// ── stripe-webhook handler ────────────────────────────────────────────────────

describe('stripe-webhook handler', () => {
  function makeRepo() {
    return {
      upsert: jest.fn().mockResolvedValue(undefined),
      findByStripeCustomerId: jest.fn().mockResolvedValue(null),
    };
  }

  const passVerifier = {
    verify: (_p: string, _s: string, _sec: string) => JSON.parse(_p),
  };

  const failVerifier = {
    verify: () => { throw new Error('bad sig'); },
  };

  it('returns 400 on invalid signature', async () => {
    const handler = createStripeWebhookHandler(makeRepo(), failVerifier, 'whsec_test');
    const result = await handler('{}', 'bad');
    expect(result.status).toBe(400);
  });

  it('marks subscription active on payment_intent.succeeded with matrixUserId in metadata', async () => {
    const repo = makeRepo();
    const handler = createStripeWebhookHandler(repo, passVerifier, 'whsec_test');
    const event = {
      type: 'payment_intent.succeeded',
      data: {object: {customer: 'cus_1', metadata: {matrix_user_id: '@alice:sauti.test'}}},
    };
    const result = await handler(JSON.stringify(event), 't=1,v1=sig');
    expect(result.status).toBe(200);
    expect(repo.upsert).toHaveBeenCalledWith('@alice:sauti.test', 'active');
  });

  it('falls back to customer lookup when no matrixUserId in metadata', async () => {
    const repo = makeRepo();
    repo.findByStripeCustomerId.mockResolvedValue({matrixUserId: '@bob:sauti.test'});
    const handler = createStripeWebhookHandler(repo, passVerifier, 'whsec_test');
    const event = {
      type: 'payment_intent.succeeded',
      data: {object: {customer: 'cus_2', metadata: {}}},
    };
    await handler(JSON.stringify(event), 't=1,v1=sig');
    expect(repo.findByStripeCustomerId).toHaveBeenCalledWith('cus_2');
    expect(repo.upsert).toHaveBeenCalledWith('@bob:sauti.test', 'active');
  });

  it('marks subscription cancelled on customer.subscription.deleted', async () => {
    const repo = makeRepo();
    const handler = createStripeWebhookHandler(repo, passVerifier, 'whsec_test');
    const event = {
      type: 'customer.subscription.deleted',
      data: {object: {customer: 'cus_1', metadata: {matrix_user_id: '@alice:sauti.test'}}},
    };
    await handler(JSON.stringify(event), 't=1,v1=sig');
    expect(repo.upsert).toHaveBeenCalledWith('@alice:sauti.test', 'cancelled');
  });

  it('marks subscription expired on invoice.payment_failed', async () => {
    const repo = makeRepo();
    repo.findByStripeCustomerId.mockResolvedValue({matrixUserId: '@alice:sauti.test'});
    const handler = createStripeWebhookHandler(repo, passVerifier, 'whsec_test');
    const event = {
      type: 'invoice.payment_failed',
      data: {object: {customer: 'cus_1'}},
    };
    await handler(JSON.stringify(event), 't=1,v1=sig');
    expect(repo.upsert).toHaveBeenCalledWith('@alice:sauti.test', 'expired');
  });

  it('returns 200 and does nothing for unknown event types', async () => {
    const repo = makeRepo();
    const handler = createStripeWebhookHandler(repo, passVerifier, 'whsec_test');
    const event = {type: 'some.other.event', data: {object: {}}};
    const result = await handler(JSON.stringify(event), 't=1,v1=sig');
    expect(result.status).toBe(200);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
