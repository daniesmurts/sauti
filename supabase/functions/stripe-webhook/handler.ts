/**
 * stripe-webhook edge function handler.
 *
 * Receives Stripe webhook events and updates the subscriptions table in
 * Supabase when a payment succeeds or a subscription lapses.
 *
 * Required Supabase secrets:
 *   STRIPE_WEBHOOK_SECRET — whsec_… (from Stripe dashboard)
 *
 * Handled events:
 *   payment_intent.succeeded        → mark subscription active
 *   customer.subscription.deleted   → mark subscription cancelled
 *   invoice.payment_failed          → mark subscription expired
 */

import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export type WebhookEvent =
  | {type: 'payment_intent.succeeded'; data: {object: {customer: string; metadata?: {matrix_user_id?: string}}}}
  | {type: 'customer.subscription.deleted'; data: {object: {customer: string; metadata?: {matrix_user_id?: string}}}}
  | {type: 'invoice.payment_failed'; data: {object: {customer: string; subscription?: string}}}
  | {type: string; data: {object: unknown}};

export interface SubscriptionRepository {
  upsert(matrixUserId: string, status: 'active' | 'expired' | 'cancelled'): Promise<void>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<{matrixUserId: string} | null>;
}

export interface WebhookVerifier {
  verify(payload: string, signature: string, secret: string): WebhookEvent;
}

export function createStripeWebhookHandler(
  repository: SubscriptionRepository,
  verifier: WebhookVerifier,
  webhookSecret: string,
) {
  return async function handle(
    payload: string,
    signature: string,
  ): Promise<EdgeResponse<{received: boolean} | {error: string}>> {
    let event: WebhookEvent;
    try {
      event = verifier.verify(payload, signature, webhookSecret);
    } catch {
      return jsonResponse(400, {error: 'Webhook signature verification failed.'});
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const {customer, metadata} = event.data.object;
        const matrixUserId = metadata?.matrix_user_id;
        if (matrixUserId) {
          await repository.upsert(matrixUserId, 'active');
        } else {
          const found = await repository.findByStripeCustomerId(customer);
          if (found) await repository.upsert(found.matrixUserId, 'active');
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const {customer, metadata} = event.data.object;
        const matrixUserId = metadata?.matrix_user_id;
        if (matrixUserId) {
          await repository.upsert(matrixUserId, 'cancelled');
        } else {
          const found = await repository.findByStripeCustomerId(customer);
          if (found) await repository.upsert(found.matrixUserId, 'cancelled');
        }
      } else if (event.type === 'invoice.payment_failed') {
        const {customer} = event.data.object;
        const found = await repository.findByStripeCustomerId(customer);
        if (found) await repository.upsert(found.matrixUserId, 'expired');
      }
      // All other events acknowledged but ignored
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    return jsonResponse(200, {received: true});
  };
}
