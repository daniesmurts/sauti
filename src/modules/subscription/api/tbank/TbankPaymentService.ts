/**
 * TbankPaymentService — orchestrates the full PCI DSS payment flow:
 *
 *   Init → Check3DSVersion → FinishAuthorize
 *     → if 3DS needed: return ACS challenge params for WebView
 *     → on 3DS v1 complete: Submit3DSAuthorization
 *     → poll GetState until terminal status
 *
 * Card data never reaches the Sauti backend. It is RSA-encrypted on-device
 * and sent directly to Tbank. The CardDataEncryptor interface abstracts
 * the RSA step so it can be mocked in tests and swapped for a platform-
 * specific implementation in production.
 */

import {TbankApiClient} from './TbankApiClient';

// ── Card data encryption ──────────────────────────────────────────────────────

export interface CardDetails {
  pan: string;
  expDate: string;   // MMYY e.g. "0526"
  cvv: string;
  cardHolder: string;
}

/**
 * Encrypts raw card data to the format Tbank accepts in CardData fields.
 * In production: RSA-OAEP with Tbank's public key, result base64-encoded.
 * Inject a no-op encryptor in tests.
 */
export interface CardDataEncryptor {
  encrypt(card: CardDetails): string;
}

/** Test / development stub — formats card data in plaintext (never use in prod). */
export class PlaintextCardDataEncryptor implements CardDataEncryptor {
  encrypt(card: CardDetails): string {
    return [
      `PAN=${card.pan}`,
      `ExpDate=${card.expDate}`,
      `CardHolder=${card.cardHolder}`,
      `CVV=${card.cvv}`,
    ].join(';');
  }
}

// ── Payment result types ──────────────────────────────────────────────────────

export type TbankPaymentResult =
  | {outcome: 'success'; paymentId: string}
  | {outcome: 'needs_3ds_v1'; paymentId: string; acsUrl: string; md: string; paReq: string}
  | {outcome: 'needs_3ds_v2'; paymentId: string; acsUrl: string; cReq: string}
  | {outcome: 'cancelled'}
  | {outcome: 'error'; message: string; errorCode?: string};

// ── Service ───────────────────────────────────────────────────────────────────

const TERMINAL_STATUS_CONFIRMED = 'CONFIRMED';
const TERMINAL_STATUS_REJECTED = 'REJECTED';
const TERMINAL_STATUS_CANCELLED = 'CANCELLED';
const TERMINAL_STATUSES = new Set([
  TERMINAL_STATUS_CONFIRMED,
  TERMINAL_STATUS_REJECTED,
  TERMINAL_STATUS_CANCELLED,
  'AUTH_FAIL',
]);

export class TbankPaymentService {
  constructor(
    private readonly client: TbankApiClient,
    private readonly encryptor: CardDataEncryptor,
  ) {}

  async initiatePayment(params: {
    amountKopecks: number;
    orderId: string;
    description?: string;
    customerKey?: string;
    card: CardDetails;
    customerIp?: string;
  }): Promise<TbankPaymentResult> {
    // Step 1 — Init
    const initResult = await this.client.init({
      Amount: params.amountKopecks,
      OrderId: params.orderId,
      Description: params.description,
      CustomerKey: params.customerKey,
      PayType: 'O', // one-stage
    });

    if (!initResult.Success) {
      return {
        outcome: 'error',
        message: initResult.Message ?? 'Payment init failed.',
        errorCode: initResult.ErrorCode,
      };
    }

    const paymentId = initResult.PaymentId;
    const cardData = this.encryptor.encrypt(params.card);

    // Step 2 — Check3DSVersion
    const check3ds = await this.client.check3dsVersion({
      PaymentId: paymentId,
      CardData: cardData,
    });

    if (!check3ds.Success) {
      return {outcome: 'error', message: check3ds.Message ?? '3DS check failed.'};
    }

    // Step 3 — FinishAuthorize
    const finish = await this.client.finishAuthorize({
      PaymentId: paymentId,
      CardData: cardData,
      IP: params.customerIp,
    });

    if (!finish.Success && finish.ErrorCode && finish.ErrorCode !== '0') {
      return {outcome: 'error', message: finish.Message ?? 'Authorize failed.', errorCode: finish.ErrorCode};
    }

    // No 3DS required — check terminal status
    if (finish.Status === TERMINAL_STATUS_CONFIRMED) {
      return {outcome: 'success', paymentId};
    }

    if (finish.Status === TERMINAL_STATUS_REJECTED || finish.Status === TERMINAL_STATUS_CANCELLED) {
      return {outcome: 'cancelled'};
    }

    // 3DS v1.0 challenge required
    if (finish.ACSUrl && finish.PaReq && finish.MD) {
      return {
        outcome: 'needs_3ds_v1',
        paymentId,
        acsUrl: finish.ACSUrl,
        md: finish.MD,
        paReq: finish.PaReq,
      };
    }

    // 3DS v2.1 challenge required
    if (finish.ACSUrl && finish.CReq) {
      return {
        outcome: 'needs_3ds_v2',
        paymentId,
        acsUrl: finish.ACSUrl,
        cReq: finish.CReq,
      };
    }

    // Unexpected state — poll for final status
    return this.pollUntilTerminal(paymentId);
  }

  /** Called after 3DS v1 WebView completes — submit PaRes and get final status. */
  async complete3DSv1(paymentId: string, md: string, paRes: string): Promise<TbankPaymentResult> {
    const result = await this.client.submit3DSAuthorization({PaymentId: paymentId, MD: md, PaRes: paRes});

    if (!result.Success) {
      return {outcome: 'error', message: result.Message ?? '3DS auth failed.', errorCode: result.ErrorCode};
    }

    if (result.Status === TERMINAL_STATUS_CONFIRMED) {
      return {outcome: 'success', paymentId};
    }

    if (result.Status === TERMINAL_STATUS_REJECTED || result.Status === TERMINAL_STATUS_CANCELLED) {
      return {outcome: 'cancelled'};
    }

    return this.pollUntilTerminal(paymentId);
  }

  /** Called after 3DS v2.1 challenge WebView completes — poll for terminal status. */
  async complete3DSv2(paymentId: string): Promise<TbankPaymentResult> {
    return this.pollUntilTerminal(paymentId);
  }

  private async pollUntilTerminal(
    paymentId: string,
    maxAttempts = 8,
    intervalMs = 1500,
  ): Promise<TbankPaymentResult> {
    for (let i = 0; i < maxAttempts; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
      const state = await this.client.getState({PaymentId: paymentId});
      if (!state.Success) {
        return {outcome: 'error', message: state.Message ?? 'GetState failed.'};
      }
      if (TERMINAL_STATUSES.has(state.Status)) {
        if (state.Status === TERMINAL_STATUS_CONFIRMED) {
          return {outcome: 'success', paymentId};
        }
        if (state.Status === TERMINAL_STATUS_CANCELLED) {
          return {outcome: 'cancelled'};
        }
        return {outcome: 'error', message: state.Message ?? `Payment ${state.Status}.`, errorCode: state.ErrorCode};
      }
    }
    return {outcome: 'error', message: 'Payment status timed out.'};
  }
}
