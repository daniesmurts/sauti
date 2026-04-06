import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface VerifyOtpRequest {
  phoneNumber: string;
  otpCode: string;
  requestId?: string;
}

export interface VerifyOtpResult {
  verified: true;
}

export interface OtpVerificationRequestRecord {
  requestId: string;
  phoneNumber: string;
  providerRequestId?: string;
  expiresAt?: string;
  verifiedAt?: string;
}

export interface OtpVerificationGateway {
  verifyOtp(input: {
    phoneNumber: string;
    otpCode: string;
    providerRequestId?: string;
  }): Promise<boolean>;
}

export interface OtpVerificationRepository {
  findRequestById(requestId: string): Promise<OtpVerificationRequestRecord | null>;
  markVerified(input: {requestId: string; verifiedAt: string}): Promise<void>;
}

export interface VerifyOtpDependencies {
  gateway: OtpVerificationGateway;
  repository: OtpVerificationRepository;
  now?: () => Date;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function isValidPhoneNumber(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value);
}

function isValidOtpCode(value: string): boolean {
  return /^\d{4,8}$/.test(value);
}

function isVerifyOtpRequest(value: unknown): value is VerifyOtpRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.phoneNumber === 'string' &&
    typeof candidate.otpCode === 'string' &&
    (typeof candidate.requestId === 'undefined' || typeof candidate.requestId === 'string')
  );
}

function isExpired(record: OtpVerificationRequestRecord, currentTime: Date): boolean {
  if (!record.expiresAt) {
    return false;
  }

  return new Date(record.expiresAt).getTime() < currentTime.getTime();
}

export function createVerifyOtpHandler(dependencies: VerifyOtpDependencies) {
  const now = dependencies.now ?? (() => new Date());

  return async function handleVerifyOtp(
    request: unknown,
  ): Promise<EdgeResponse<VerifyOtpResult | {error: string}>> {
    if (!isVerifyOtpRequest(request)) {
      return jsonResponse(400, {error: 'Invalid OTP verification payload.'});
    }

    const phoneNumber = normalizePhoneNumber(request.phoneNumber.trim());
    const otpCode = request.otpCode.trim();
    const requestId = request.requestId?.trim() || undefined;

    if (!isValidPhoneNumber(phoneNumber)) {
      return jsonResponse(400, {error: 'Phone number must be in international format.'});
    }

    if (!isValidOtpCode(otpCode)) {
      return jsonResponse(400, {error: 'OTP code must be 4 to 8 digits.'});
    }

    let providerRequestId: string | undefined;
    if (requestId) {
      const storedRequest = await dependencies.repository.findRequestById(requestId);
      if (!storedRequest) {
        return jsonResponse(404, {error: 'OTP request was not found.'});
      }

      if (storedRequest.phoneNumber !== phoneNumber) {
        return jsonResponse(400, {error: 'OTP request does not match phone number.'});
      }

      if (storedRequest.verifiedAt) {
        return jsonResponse(409, {error: 'OTP request has already been used.'});
      }

      if (isExpired(storedRequest, now())) {
        return jsonResponse(410, {error: 'OTP request has expired.'});
      }

      providerRequestId = storedRequest.providerRequestId;
    }

    const verified = await dependencies.gateway.verifyOtp({
      phoneNumber,
      otpCode,
      providerRequestId,
    });
    if (!verified) {
      return jsonResponse(401, {error: 'OTP verification failed.'});
    }

    if (requestId) {
      await dependencies.repository.markVerified({
        requestId,
        verifiedAt: now().toISOString(),
      });
    }

    return jsonResponse(200, {verified: true});
  };
}