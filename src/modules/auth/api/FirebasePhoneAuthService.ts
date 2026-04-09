import {getAuth, signInWithPhoneNumber} from '@react-native-firebase/auth';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

import {SautiError} from '../../../core/matrix/MatrixClient';

import type {RequestOtpInput, RequestOtpResult, VerifyOtpInput, VerifyOtpResult} from './OtpAuthService';

function mapFirebaseError(error: unknown): SautiError {
  if (error instanceof SautiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Phone authentication failed.';
  const code = error instanceof Error && 'code' in error ? (error as {code: string}).code : '';

  if (code === 'auth/invalid-phone-number') {
    return new SautiError('AUTH_OTP_REQUEST_FAILED', 'Invalid phone number format.');
  }

  if (code === 'auth/too-many-requests') {
    return new SautiError('AUTH_OTP_REQUEST_FAILED', 'Too many attempts. Please try again later.');
  }

  if (code === 'auth/invalid-verification-code') {
    return new SautiError('AUTH_OTP_VERIFY_FAILED', 'The verification code is incorrect.');
  }

  if (code === 'auth/session-expired') {
    return new SautiError('AUTH_OTP_VERIFY_FAILED', 'Verification session expired. Please request a new code.');
  }

  if (code === 'auth/network-request-failed') {
    return new SautiError('AUTH_OTP_REQUEST_FAILED', 'Network connection unavailable.');
  }

  return new SautiError('AUTH_OTP_REQUEST_FAILED', message, error);
}

export class FirebasePhoneAuthService {
  private confirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

  async requestOtp(request: RequestOtpInput): Promise<RequestOtpResult> {
    try {
      this.confirmation = await signInWithPhoneNumber(getAuth(), request.phoneNumber);

      return {
        requestId: this.confirmation.verificationId ?? undefined,
        expiresInSeconds: 300,
      };
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }

  async verifyOtp(request: VerifyOtpInput): Promise<VerifyOtpResult> {
    try {
      if (!this.confirmation) {
        throw new SautiError(
          'AUTH_OTP_VERIFY_FAILED',
          'No pending verification. Please request a new code.',
        );
      }

        const credential = await this.confirmation.confirm(request.otpCode);

        let firebaseIdToken: string | undefined;
        if (credential?.user) {
          try {
            firebaseIdToken = await credential.user.getIdToken();
          } catch {
            // Non-critical — edge function will fall back to OTP verification if absent.
          }
        }

      // Sign out of Firebase after verification — we only use Firebase for
      // phone number verification, not as a session authority.
      // Supabase + Matrix credentials remain the session authority.
      try {
        await getAuth().signOut();
      } catch {
        // Non-critical — the Firebase session will expire on its own.
      }

        return {verified: true, firebaseIdToken};
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }
}
