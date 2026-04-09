import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface RegisterMatrixUserRequest {
  phoneNumber: string;
  otpCode: string;
  password: string;
  displayName?: string;
    firebaseIdToken?: string;
}

export interface RegisterMatrixUserResult {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs: number;
}

export interface MatrixProvisioningGateway {
  registerUser(input: {
    phoneNumber: string;
    password: string;
    displayName?: string;
  }): Promise<RegisterMatrixUserResult>;
}

export interface OtpVerificationGateway {
  verifyOtp(input: {phoneNumber: string; otpCode: string}): Promise<boolean>;
}

  export interface FirebaseTokenVerificationGateway {
    /**
     * Verifies a Firebase ID token and returns the verified phone number,
     * or null if the token is invalid / cannot be verified.
     */
    verifyToken(idToken: string): Promise<string | null>;
  }

export interface MatrixRegistrationRepository {
  upsertRegistration(input: {
    phoneNumber: string;
    matrixUserId: string;
    displayName?: string;
    lastDeviceId?: string;
  }): Promise<void>;
}

export interface RegisterMatrixUserDependencies {
  otpVerifier: OtpVerificationGateway;
    firebaseTokenVerifier?: FirebaseTokenVerificationGateway;
  matrixGateway: MatrixProvisioningGateway;
  repository: MatrixRegistrationRepository;
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

function isValidPassword(value: string): boolean {
  return value.trim().length >= 8;
}

function isRegisterRequest(value: unknown): value is RegisterMatrixUserRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.phoneNumber === 'string' &&
    typeof candidate.otpCode === 'string' &&
    typeof candidate.password === 'string' &&
    (typeof candidate.displayName === 'undefined' ||
        typeof candidate.displayName === 'string') &&
      (typeof candidate.firebaseIdToken === 'undefined' ||
        typeof candidate.firebaseIdToken === 'string')
  );
}

export function createRegisterMatrixUserHandler(
  dependencies: RegisterMatrixUserDependencies,
) {
  return async function handleRegisterMatrixUser(
    request: unknown,
  ): Promise<EdgeResponse<RegisterMatrixUserResult | {error: string}>> {
    if (!isRegisterRequest(request)) {
      return jsonResponse(400, {error: 'Invalid registration payload.'});
    }

    const phoneNumber = normalizePhoneNumber(request.phoneNumber.trim());
    const otpCode = request.otpCode.trim();
    const password = request.password.trim();
    const displayName = request.displayName?.trim() || undefined;
      const firebaseIdToken = request.firebaseIdToken?.trim() || undefined;

    if (!isValidPhoneNumber(phoneNumber)) {
      return jsonResponse(400, {error: 'Phone number must be in international format.'});
    }

    if (!isValidOtpCode(otpCode)) {
      return jsonResponse(400, {error: 'OTP code must be 4 to 8 digits.'});
    }

    if (!isValidPassword(password)) {
      return jsonResponse(400, {error: 'Password must be at least 8 characters.'});
    }

      if (firebaseIdToken) {
        if (!dependencies.firebaseTokenVerifier) {
          return jsonResponse(500, {error: 'Firebase token verification is not configured.'});
        }
        const verifiedPhone = await dependencies.firebaseTokenVerifier.verifyToken(firebaseIdToken);
        if (!verifiedPhone || normalizePhoneNumber(verifiedPhone) !== phoneNumber) {
          return jsonResponse(401, {error: 'Firebase ID token is invalid or phone number mismatch.'});
        }
      } else {
        const otpValid = await dependencies.otpVerifier.verifyOtp({phoneNumber, otpCode});
        if (!otpValid) {
          return jsonResponse(401, {error: 'OTP verification failed.'});
        }
    }

    const registration = await dependencies.matrixGateway.registerUser({
      phoneNumber,
      password,
      displayName,
    });

    await dependencies.repository.upsertRegistration({
      phoneNumber,
      matrixUserId: registration.userId,
      displayName,
      lastDeviceId: registration.deviceId,
    });

    return jsonResponse(200, registration);
  };
}
