/**
 * create-payment-intent edge function handler.
 *
 * Called by the app before presenting the Stripe Payment Sheet.
 * Creates (or retrieves) a Stripe Customer, an EphemeralKey, and a
 * PaymentIntent, then returns the secrets the Payment Sheet needs.
 *
 * Required Supabase secrets:
 *   STRIPE_SECRET_KEY        — sk_live_… or sk_test_…
 *   STRIPE_SUBSCRIPTION_PRICE_ID — price_…
 */

import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface CreatePaymentIntentRequest {
  matrixUserId: string;
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  publishableKey: string;
}

export interface StripeApi {
  createOrRetrieveCustomer(matrixUserId: string): Promise<{id: string}>;
  createEphemeralKey(customerId: string): Promise<{secret: string}>;
  createPaymentIntent(customerId: string, priceId: string): Promise<{client_secret: string}>;
}

export interface CreatePaymentIntentEnv {
  stripeSecretKey: string;
  stripePriceId: string;
  stripePublishableKey: string;
}

function isRequest(value: unknown): value is CreatePaymentIntentRequest {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).matrixUserId === 'string'
  );
}

export function createPaymentIntentHandler(stripe: StripeApi, env: CreatePaymentIntentEnv) {
  return async function handle(
    request: unknown,
  ): Promise<EdgeResponse<CreatePaymentIntentResponse | {error: string}>> {
    if (!isRequest(request)) {
      return jsonResponse(400, {error: 'matrixUserId is required.'});
    }

    const matrixUserId = request.matrixUserId.trim();
    if (!matrixUserId) {
      return jsonResponse(400, {error: 'matrixUserId is required.'});
    }

    try {
      const customer = await stripe.createOrRetrieveCustomer(matrixUserId);
      const [ephemeralKeyResult, paymentIntent] = await Promise.all([
        stripe.createEphemeralKey(customer.id),
        stripe.createPaymentIntent(customer.id, env.stripePriceId),
      ]);

      return jsonResponse(200, {
        clientSecret: paymentIntent.client_secret,
        ephemeralKey: ephemeralKeyResult.secret,
        customerId: customer.id,
        publishableKey: env.stripePublishableKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe error.';
      return jsonResponse(500, {error: message});
    }
  };
}
