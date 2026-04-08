/**
 * TbankApiClient — typed low-level wrapper around the Tbank Acquiring API.
 *
 * Base URL: https://securepay.tinkoff.ru/v2/
 *
 * Every request has Token appended (SHA-256 of sorted scalar values + Password).
 * Card data is sent already RSA-encrypted by the caller — this client never
 * sees plaintext card details.
 */

import {generateTbankToken} from './token';

const BASE_URL = 'https://securepay.tinkoff.ru/v2';

// ── Response shapes ───────────────────────────────────────────────────────────

export interface TbankInitResponse {
  Success: boolean;
  PaymentId: string;
  PaymentURL?: string;
  ErrorCode?: string;
  Message?: string;
}

export interface TbankCheck3dsResponse {
  Success: boolean;
  PaymentId: string;
  Version?: '1.0' | '2.1' | null;
  ServerTransId?: string;
  ThreeDsMethodURL?: string;
  ErrorCode?: string;
  Message?: string;
}

export interface TbankFinishAuthorizeResponse {
  Success: boolean;
  PaymentId: string;
  Status: string;
  // 3DS v1.0 fields
  ACSUrl?: string;
  MD?: string;
  PaReq?: string;
  // 3DS v2.1 fields
  CReq?: string;
  AcsTransId?: string;
  ErrorCode?: string;
  Message?: string;
}

export interface TbankSubmit3DSResponse {
  Success: boolean;
  PaymentId: string;
  Status: string;
  ErrorCode?: string;
  Message?: string;
}

export interface TbankGetStateResponse {
  Success: boolean;
  PaymentId: string;
  Status: string;
  Amount?: number;
  OrderId?: string;
  ErrorCode?: string;
  Message?: string;
}

// ── Client ────────────────────────────────────────────────────────────────────

export interface TbankClientConfig {
  terminalKey: string;
  password: string;
  fetchFn?: typeof fetch;
}

export class TbankApiClient {
  private readonly terminalKey: string;
  private readonly password: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: TbankClientConfig) {
    this.terminalKey = config.terminalKey;
    this.password = config.password;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async init(params: {
    Amount: number;
    OrderId: string;
    Description?: string;
    CustomerKey?: string;
    PayType?: 'O' | 'T';
  }): Promise<TbankInitResponse> {
    return this.post<TbankInitResponse>('Init', params);
  }

  async check3dsVersion(params: {
    PaymentId: string;
    CardData: string;
  }): Promise<TbankCheck3dsResponse> {
    return this.post<TbankCheck3dsResponse>('Check3dsVersion', params);
  }

  async finishAuthorize(params: {
    PaymentId: string;
    CardData: string;
    IP?: string;
    InfoEmail?: string;
    SendEmail?: boolean;
    Data?: Record<string, string>;
  }): Promise<TbankFinishAuthorizeResponse> {
    return this.post<TbankFinishAuthorizeResponse>('FinishAuthorize', params);
  }

  async submit3DSAuthorization(params: {
    PaymentId: string;
    MD: string;
    PaRes: string;
  }): Promise<TbankSubmit3DSResponse> {
    return this.post<TbankSubmit3DSResponse>('Submit3DSAuthorization', params);
  }

  async getState(params: {PaymentId: string}): Promise<TbankGetStateResponse> {
    return this.post<TbankGetStateResponse>('GetState', params);
  }

  private async post<T>(endpoint: string, params: Record<string, unknown>): Promise<T> {
    const body: Record<string, unknown> = {
      ...params,
      TerminalKey: this.terminalKey,
    };
    body.Token = generateTbankToken(body, this.password);

    const response = await this.fetchFn(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Tbank ${endpoint} failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}
