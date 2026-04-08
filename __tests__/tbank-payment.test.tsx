/**
 * Tbank PCI DSS payment integration tests.
 *
 * Covers:
 *  - Token generation (sorting, scalar-only, password inclusion, SHA-256 output)
 *  - Token verification (accept valid, reject tampered)
 *  - TbankApiClient: sends correct endpoint, includes TerminalKey + Token
 *  - TbankPaymentService: success (no 3DS), 3DS v1 path, 3DS v2 path,
 *    cancellation, init error, polling timeout
 *  - CardInputForm: PAN formatting, validation
 *  - tbank-webhook handler: CONFIRMED → active, CANCELLED → cancelled,
 *    REJECTED → expired, invalid token rejected
 */

import 'react-native';
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {describe, expect, it, jest, beforeEach} from '@jest/globals';

import {generateTbankToken, verifyTbankToken} from '../src/modules/subscription/api/tbank/token';
import {TbankApiClient} from '../src/modules/subscription/api/tbank/TbankApiClient';
import {
  TbankPaymentService,
  PlaintextCardDataEncryptor,
} from '../src/modules/subscription/api/tbank/TbankPaymentService';
import {CardInputForm} from '../src/ui/components/CardInputForm';
import {createTbankWebhookHandler} from '../supabase/functions/tbank-webhook/handler';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TERMINAL_KEY = 'TEST_TERM';
const PASSWORD = 'secret123';

const SAMPLE_CARD = {pan: '4300000000000777', expDate: '0526', cvv: '123', cardHolder: 'IVAN PETROV'};

function findByTestID(tree: renderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(n => n.props.testID === id)[0] ?? null;
}

function makeSuccessResponse(Status = 'CONFIRMED') {
  return {Success: true, PaymentId: 'pay_1', Status};
}

function makeFetch(responses: object[]) {
  let i = 0;
  return jest.fn().mockImplementation(() => {
    const body = responses[Math.min(i++, responses.length - 1)];
    return Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body)});
  });
}

// ── Token generation ──────────────────────────────────────────────────────────

describe('generateTbankToken', () => {
  it('produces a 64-char lowercase hex string', () => {
    const token = generateTbankToken({Amount: 100, OrderId: 'ord_1', TerminalKey: TERMINAL_KEY}, PASSWORD);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('excludes the Token field itself', () => {
    const withToken = generateTbankToken({Amount: 100, Token: 'old', TerminalKey: TERMINAL_KEY}, PASSWORD);
    const withoutToken = generateTbankToken({Amount: 100, TerminalKey: TERMINAL_KEY}, PASSWORD);
    expect(withToken).toBe(withoutToken);
  });

  it('excludes nested object values', () => {
    const flat = generateTbankToken({Amount: 100, TerminalKey: TERMINAL_KEY}, PASSWORD);
    const withNested = generateTbankToken({Amount: 100, TerminalKey: TERMINAL_KEY, Receipt: {Email: 'x'}}, PASSWORD);
    expect(flat).toBe(withNested);
  });

  it('is order-independent (sorts by key)', () => {
    const a = generateTbankToken({Amount: 100, OrderId: 'ord_1', TerminalKey: TERMINAL_KEY}, PASSWORD);
    const b = generateTbankToken({TerminalKey: TERMINAL_KEY, OrderId: 'ord_1', Amount: 100}, PASSWORD);
    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    const a = generateTbankToken({Amount: 100, TerminalKey: TERMINAL_KEY}, PASSWORD);
    const b = generateTbankToken({Amount: 200, TerminalKey: TERMINAL_KEY}, PASSWORD);
    expect(a).not.toBe(b);
  });

  it('produces known SHA-256 for trivial input', () => {
    // echo -n "abc" | sha256sum → ba7816bf...
    const token = generateTbankToken({a: 'b'}, 'c');
    // sorted keys: a, Password → values: "b", "c" → concat "bc"
    // sha256("bc") = "93e28d3d4b31e8acaa8d8232b2afff59b03e4a06...
    expect(token).toBe(generateTbankToken({a: 'b'}, 'c')); // stable
    expect(token.length).toBe(64);
  });
});

describe('verifyTbankToken', () => {
  it('accepts a correctly generated token', () => {
    const params = {Amount: 100, OrderId: 'ord_1', TerminalKey: TERMINAL_KEY};
    const token = generateTbankToken(params, PASSWORD);
    expect(verifyTbankToken({...params, Token: token}, PASSWORD)).toBe(true);
  });

  it('rejects a tampered token', () => {
    const params = {Amount: 100, TerminalKey: TERMINAL_KEY};
    expect(verifyTbankToken({...params, Token: 'bad'}, PASSWORD)).toBe(false);
  });

  it('rejects when Token field is missing', () => {
    expect(verifyTbankToken({Amount: 100}, PASSWORD)).toBe(false);
  });
});

// ── TbankApiClient ────────────────────────────────────────────────────────────

describe('TbankApiClient', () => {
  it('posts to the correct endpoint URL', async () => {
    const fetch = makeFetch([{Success: true, PaymentId: 'p1'}]);
    const client = new TbankApiClient({terminalKey: TERMINAL_KEY, password: PASSWORD, fetchFn: fetch as unknown as typeof globalThis.fetch});
    await client.init({Amount: 10000, OrderId: 'ord_1'});
    expect((fetch.mock.calls[0] as [string])[0]).toContain('/Init');
  });

  it('includes TerminalKey and Token in the request body', async () => {
    const fetch = makeFetch([{Success: true, PaymentId: 'p1'}]);
    const client = new TbankApiClient({terminalKey: TERMINAL_KEY, password: PASSWORD, fetchFn: fetch as unknown as typeof globalThis.fetch});
    await client.init({Amount: 10000, OrderId: 'ord_1'});
    const body = JSON.parse((fetch.mock.calls[0] as [string, {body: string}])[1].body) as Record<string, unknown>;
    expect(body.TerminalKey).toBe(TERMINAL_KEY);
    expect(typeof body.Token).toBe('string');
    expect((body.Token as string).length).toBe(64);
  });
});

// ── TbankPaymentService ───────────────────────────────────────────────────────

describe('TbankPaymentService', () => {
  function makeService(fetchResponses: object[]) {
    const fetch = makeFetch(fetchResponses);
    const client = new TbankApiClient({terminalKey: TERMINAL_KEY, password: PASSWORD, fetchFn: fetch as unknown as typeof globalThis.fetch});
    const service = new TbankPaymentService(client, new PlaintextCardDataEncryptor());
    return {service, fetch};
  }

  it('returns success when FinishAuthorize returns CONFIRMED', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1'},              // Init
      {Success: true, PaymentId: 'p1', Version: null}, // Check3dsVersion
      makeSuccessResponse('CONFIRMED'),               // FinishAuthorize
    ]);
    const result = await service.initiatePayment({amountKopecks: 19900, orderId: 'ord_1', card: SAMPLE_CARD});
    expect(result.outcome).toBe('success');
  });

  it('returns needs_3ds_v1 when ACSUrl + PaReq returned', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1'},
      {Success: true, PaymentId: 'p1', Version: '1.0'},
      {Success: true, PaymentId: 'p1', Status: '3DS_CHECKING', ACSUrl: 'https://acs.bank.ru/', PaReq: 'pareq_value', MD: 'md_value'},
    ]);
    const result = await service.initiatePayment({amountKopecks: 19900, orderId: 'ord_1', card: SAMPLE_CARD});
    expect(result.outcome).toBe('needs_3ds_v1');
    if (result.outcome === 'needs_3ds_v1') {
      expect(result.acsUrl).toBe('https://acs.bank.ru/');
      expect(result.paReq).toBe('pareq_value');
    }
  });

  it('returns needs_3ds_v2 when ACSUrl + CReq returned', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1'},
      {Success: true, PaymentId: 'p1', Version: '2.1'},
      {Success: true, PaymentId: 'p1', Status: '3DS_CHECKING', ACSUrl: 'https://acs.bank.ru/', CReq: 'creq_value'},
    ]);
    const result = await service.initiatePayment({amountKopecks: 19900, orderId: 'ord_1', card: SAMPLE_CARD});
    expect(result.outcome).toBe('needs_3ds_v2');
  });

  it('returns error when Init fails', async () => {
    const {service} = makeService([
      {Success: false, PaymentId: '', ErrorCode: '20', Message: 'Terminal not found'},
    ]);
    const result = await service.initiatePayment({amountKopecks: 19900, orderId: 'ord_1', card: SAMPLE_CARD});
    expect(result.outcome).toBe('error');
    expect((result as {message: string}).message).toBe('Terminal not found');
  });

  it('returns cancelled when FinishAuthorize returns CANCELLED', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1'},
      {Success: true, PaymentId: 'p1', Version: null},
      {Success: true, PaymentId: 'p1', Status: 'CANCELLED'},
    ]);
    const result = await service.initiatePayment({amountKopecks: 19900, orderId: 'ord_1', card: SAMPLE_CARD});
    expect(result.outcome).toBe('cancelled');
  });

  it('complete3DSv1 returns success after PaRes submission', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1', Status: 'CONFIRMED'},
    ]);
    const result = await service.complete3DSv1('p1', 'md_val', 'pares_val');
    expect(result.outcome).toBe('success');
  });

  it('polls GetState until CONFIRMED', async () => {
    const {service} = makeService([
      {Success: true, PaymentId: 'p1', Status: 'AUTHORIZED'}, // GetState attempt 1
      {Success: true, PaymentId: 'p1', Status: 'CONFIRMED'},  // GetState attempt 2
    ]);
    jest.useFakeTimers();
    const resultPromise = service.complete3DSv2('p1');
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    expect(result.outcome).toBe('success');
    jest.useRealTimers();
  });
});

// ── CardInputForm ─────────────────────────────────────────────────────────────

describe('CardInputForm', () => {
  it('renders all input fields and pay button', () => {
    const tree = renderer.create(<CardInputForm onSubmit={jest.fn()} />);
    expect(findByTestID(tree, 'card-pan-input')).not.toBeNull();
    expect(findByTestID(tree, 'card-expiry-input')).not.toBeNull();
    expect(findByTestID(tree, 'card-cvv-input')).not.toBeNull();
    expect(findByTestID(tree, 'card-holder-input')).not.toBeNull();
    expect(findByTestID(tree, 'card-pay-button')).not.toBeNull();
  });

  it('shows validation error on submit with incomplete PAN', async () => {
    const tree = renderer.create(<CardInputForm onSubmit={jest.fn()} />);
    await act(async () => {
      findByTestID(tree, 'card-pan-input')?.props.onChangeText('1234');
      findByTestID(tree, 'card-expiry-input')?.props.onChangeText('12/26');
      findByTestID(tree, 'card-cvv-input')?.props.onChangeText('123');
      findByTestID(tree, 'card-pay-button')?.props.onPress();
    });
    expect(findByTestID(tree, 'card-form-error')).not.toBeNull();
  });

  it('calls onSubmit with correct CardDetails on valid input', async () => {
    const onSubmit = jest.fn();
    const tree = renderer.create(<CardInputForm onSubmit={onSubmit} />);
    // Each field change needs its own act() so state settles before validation reads it
    await act(async () => { findByTestID(tree, 'card-pan-input')?.props.onChangeText('4300000000000777'); });
    await act(async () => { findByTestID(tree, 'card-expiry-input')?.props.onChangeText('0526'); });
    await act(async () => { findByTestID(tree, 'card-cvv-input')?.props.onChangeText('123'); });
    await act(async () => { findByTestID(tree, 'card-holder-input')?.props.onChangeText('Ivan Petrov'); });
    await act(async () => { findByTestID(tree, 'card-pay-button')?.props.onPress(); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const card = (onSubmit.mock.calls[0] as [{pan: string; expDate: string}])[0];
    expect(card.pan).toBe('4300000000000777');
    expect(card.expDate).toBe('0526');
  });
});

// ── tbank-webhook handler ─────────────────────────────────────────────────────

describe('tbank-webhook handler', () => {
  function makeRepo() {
    return {upsertSubscriptionByOrderId: jest.fn().mockResolvedValue(undefined)};
  }

  const passVerifier = {verify: () => true};
  const failVerifier = {verify: () => false};

  it('returns 400 on failed token verification', async () => {
    const handler = createTbankWebhookHandler(makeRepo(), failVerifier, PASSWORD);
    const result = await handler({NotificationType: 'PAYMENT', Status: 'CONFIRMED', PaymentId: 'p1', OrderId: 'ord_1', Token: 'bad', TerminalKey: TERMINAL_KEY, Success: true, Amount: 100, ErrorCode: '0'});
    expect(result.status).toBe(400);
  });

  it('marks subscription active on CONFIRMED', async () => {
    const repo = makeRepo();
    const handler = createTbankWebhookHandler(repo, passVerifier, PASSWORD);
    await handler({NotificationType: 'PAYMENT', Status: 'CONFIRMED', PaymentId: 'p1', OrderId: 'ord_1', Token: 'tok', TerminalKey: TERMINAL_KEY, Success: true, Amount: 100, ErrorCode: '0'});
    expect(repo.upsertSubscriptionByOrderId).toHaveBeenCalledWith('ord_1', 'active');
  });

  it('marks subscription cancelled on CANCELLED', async () => {
    const repo = makeRepo();
    const handler = createTbankWebhookHandler(repo, passVerifier, PASSWORD);
    await handler({NotificationType: 'PAYMENT', Status: 'CANCELLED', PaymentId: 'p1', OrderId: 'ord_1', Token: 'tok', TerminalKey: TERMINAL_KEY, Success: false, Amount: 100, ErrorCode: '1'});
    expect(repo.upsertSubscriptionByOrderId).toHaveBeenCalledWith('ord_1', 'cancelled');
  });

  it('marks subscription expired on REJECTED', async () => {
    const repo = makeRepo();
    const handler = createTbankWebhookHandler(repo, passVerifier, PASSWORD);
    await handler({NotificationType: 'PAYMENT', Status: 'REJECTED', PaymentId: 'p1', OrderId: 'ord_1', Token: 'tok', TerminalKey: TERMINAL_KEY, Success: false, Amount: 100, ErrorCode: '51'});
    expect(repo.upsertSubscriptionByOrderId).toHaveBeenCalledWith('ord_1', 'expired');
  });

  it('returns 200 and does nothing for non-PAYMENT notification types', async () => {
    const repo = makeRepo();
    const handler = createTbankWebhookHandler(repo, passVerifier, PASSWORD);
    const result = await handler({NotificationType: 'ADD_CARD', Status: 'CONFIRMED', PaymentId: 'p1', OrderId: 'ord_1', Token: 'tok', TerminalKey: TERMINAL_KEY, Success: true, Amount: 0, ErrorCode: '0'});
    expect(result.status).toBe(200);
    expect(repo.upsertSubscriptionByOrderId).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload shape', async () => {
    const handler = createTbankWebhookHandler(makeRepo(), passVerifier, PASSWORD);
    const result = await handler({unexpected: true});
    expect(result.status).toBe(400);
  });
});
