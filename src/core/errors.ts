export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TOTP_INVALID'
  | 'RECOVERY_CODE_INVALID'
  | 'RECOVERY_CODE_USED'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR';

export class AfriLinkError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AfriLinkError';
  }
}