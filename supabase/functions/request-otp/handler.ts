import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface RequestOtpRequest {
  phoneNumber: string;
}

export interface RequestOtpResult {
  requestId: string;
  expiresInSeconds?: number;
}

export interface OtpRequestGateway {
  requestOtp(input: {phoneNumber: string}): Promise<{
    providerRequestId?: string;
    expiresInSeconds?: number;
  }>;
}

export interface OtpRequestRepository {
  createRequest(input: {
    requestId: string;
    phoneNumber: string;
    providerRequestId?: string;
    expiresAt?: string;
  }): Promise<void>;
}

export interface RequestOtpDependencies {
  gateway: OtpRequestGateway;
  repository: OtpRequestRepository;
  generateRequestId?: () => string;
  now?: () => Date;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function isValidPhoneNumber(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value);
}

function isRequestOtpRequest(value: unknown): value is RequestOtpRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return typeof (value as Record<string, unknown>).phoneNumber === 'string';
}

function buildExpiresAt(now: Date, expiresInSeconds?: number): string | undefined {
  if (!expiresInSeconds || expiresInSeconds <= 0) {
    return undefined;
  }

  return new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
}

export function createRequestOtpHandler(dependencies: RequestOtpDependencies) {
  const generateRequestId = dependencies.generateRequestId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  return async function handleRequestOtp(
    request: unknown,
  ): Promise<EdgeResponse<RequestOtpResult | {error: string}>> {
    if (!isRequestOtpRequest(request)) {
      return jsonResponse(400, {error: 'phoneNumber is required.'});
    }

    const phoneNumber = normalizePhoneNumber(request.phoneNumber.trim());
    if (!isValidPhoneNumber(phoneNumber)) {
      return jsonResponse(400, {error: 'Phone number must be in international format.'});
    }

    const gatewayResult = await dependencies.gateway.requestOtp({phoneNumber});
    const requestId = generateRequestId();
    const expiresAt = buildExpiresAt(now(), gatewayResult.expiresInSeconds);

    await dependencies.repository.createRequest({
      requestId,
      phoneNumber,
      providerRequestId: gatewayResult.providerRequestId,
      expiresAt,
    });

    return jsonResponse(200, {
      requestId,
      expiresInSeconds: gatewayResult.expiresInSeconds,
    });
  };
}