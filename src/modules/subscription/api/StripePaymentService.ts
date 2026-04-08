/**
 * StripePaymentService — orchestrates the Stripe Payment Sheet flow.
 *
 * Responsibilities:
 *  1. Call the Supabase `create-payment-intent` edge function to obtain a
 *     clientSecret and ephemeralKey for the Payment Sheet.
 *  2. Initialise the Payment Sheet via the Stripe SDK.
 *  3. Present the Payment Sheet to the user.
 *  4. Return a typed result so the caller can react to success, cancellation,
 *     or failure without inspecting raw Stripe error objects.
 */

import {readSupabaseEnv} from '../../../core/config/env';

export type PaymentSheetResult =
  | {outcome: 'success'}
  | {outcome: 'cancelled'}
  | {outcome: 'error'; message: string};

export interface StripeSetupPayload {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  publishableKey: string;
}

export interface StripeSDKBridge {
  initPaymentSheet(params: {
    merchantDisplayName: string;
    customerId: string;
    customerEphemeralKeySecret: string;
    paymentIntentClientSecret: string;
    allowsDelayedPaymentMethods: boolean;
  }): Promise<{error?: {message: string} | null}>;

  presentPaymentSheet(): Promise<{error?: {message: string; code?: string} | null}>;
}

export class StripePaymentService {
  constructor(
    private readonly stripe: StripeSDKBridge,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async pay(matrixUserId: string): Promise<PaymentSheetResult> {
    // Step 1 — create payment intent via Supabase edge function
    let setup: StripeSetupPayload;
    try {
      setup = await this.createPaymentIntent(matrixUserId);
    } catch (err) {
      return {
        outcome: 'error',
        message: err instanceof Error ? err.message : 'Failed to create payment.',
      };
    }

    // Step 2 — initialise Payment Sheet
    const {error: initError} = await this.stripe.initPaymentSheet({
      merchantDisplayName: 'Sauti',
      customerId: setup.customerId,
      customerEphemeralKeySecret: setup.ephemeralKey,
      paymentIntentClientSecret: setup.clientSecret,
      allowsDelayedPaymentMethods: true,
    });

    if (initError) {
      return {outcome: 'error', message: initError.message};
    }

    // Step 3 — present
    const {error: presentError} = await this.stripe.presentPaymentSheet();

    if (!presentError) {
      return {outcome: 'success'};
    }

    if (presentError.code === 'Canceled') {
      return {outcome: 'cancelled'};
    }

    return {outcome: 'error', message: presentError.message};
  }

  private async createPaymentIntent(matrixUserId: string): Promise<StripeSetupPayload> {
    const env = readSupabaseEnv();

    const response = await this.fetchFn(
      `${env.supabaseUrl}/functions/v1/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.supabaseAnonKey,
          Authorization: `Bearer ${env.supabaseAnonKey}`,
        },
        body: JSON.stringify({matrixUserId}),
      },
    );

    if (!response.ok) {
      throw new Error(`create-payment-intent failed with status ${response.status}`);
    }

    const payload = (await response.json()) as StripeSetupPayload;
    return payload;
  }
}
