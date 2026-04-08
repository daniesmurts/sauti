/**
 * tbank-webhook edge function handler.
 *
 * Tbank sends a POST notification to this URL when payment status changes.
 * Required Supabase secret: TBANK_TERMINAL_PASSWORD
 *
 * Handled NotificationTypes:
 *   PAYMENT with Status=CONFIRMED   → mark subscription active
 *   PAYMENT with Status=CANCELLED   → mark subscription cancelled
 *   PAYMENT with Status=REJECTED    → mark subscription expired
 *
 * Token verification per Tbank spec: SHA-256 of sorted scalar values + Password.
 */

import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface TbankNotification {
  NotificationType: string;
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: string;
  PaymentId: string;
  ErrorCode: string;
  Amount: number;
  Token: string;
  [key: string]: unknown;
}

export interface NotificationRepository {
  upsertSubscriptionByOrderId(orderId: string, status: 'active' | 'expired' | 'cancelled'): Promise<void>;
}

export interface TokenVerifier {
  verify(params: Record<string, unknown>, password: string): boolean;
}

function isTbankNotification(value: unknown): value is TbankNotification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.NotificationType === 'string' &&
    typeof v.Status === 'string' &&
    typeof v.PaymentId === 'string' &&
    typeof v.OrderId === 'string' &&
    typeof v.Token === 'string'
  );
}

export function createTbankWebhookHandler(
  repository: NotificationRepository,
  verifier: TokenVerifier,
  terminalPassword: string,
) {
  return async function handle(
    body: unknown,
  ): Promise<EdgeResponse<{ok: boolean} | {error: string}>> {
    if (!isTbankNotification(body)) {
      return jsonResponse(400, {error: 'Invalid notification payload.'});
    }

    if (!verifier.verify(body as unknown as Record<string, unknown>, terminalPassword)) {
      return jsonResponse(400, {error: 'Token verification failed.'});
    }

    if (body.NotificationType !== 'PAYMENT') {
      // Acknowledge but ignore non-payment notifications
      return jsonResponse(200, {ok: true});
    }

    try {
      if (body.Status === 'CONFIRMED') {
        await repository.upsertSubscriptionByOrderId(body.OrderId, 'active');
      } else if (body.Status === 'CANCELLED') {
        await repository.upsertSubscriptionByOrderId(body.OrderId, 'cancelled');
      } else if (body.Status === 'REJECTED' || body.Status === 'AUTH_FAIL') {
        await repository.upsertSubscriptionByOrderId(body.OrderId, 'expired');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    return jsonResponse(200, {ok: true});
  };
}
