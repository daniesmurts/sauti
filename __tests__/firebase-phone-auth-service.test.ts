import {describe, expect, it, jest, beforeEach} from '@jest/globals';
import {FirebasePhoneAuthService} from '../src/modules/auth/api/FirebasePhoneAuthService';
import {
  mockSignInWithPhoneNumber,
  mockConfirm,
  mockSignOut,
  mockGetIdToken,
} from '../__mocks__/@react-native-firebase/auth';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FirebasePhoneAuthService', () => {
  describe('requestOtp', () => {
    it('calls signInWithPhoneNumber and returns verification id', async () => {
      const service = new FirebasePhoneAuthService();
      const result = await service.requestOtp({phoneNumber: '+2348012345678'});

      expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith(
        expect.objectContaining({signOut: expect.any(Function)}),
        '+2348012345678',
      );
      expect(result.requestId).toBe('mock-verification-id');
    });

    it('throws SautiError on invalid phone number', async () => {
      mockSignInWithPhoneNumber.mockRejectedValueOnce(
        Object.assign(new Error('Invalid phone'), {code: 'auth/invalid-phone-number'}),
      );

      const service = new FirebasePhoneAuthService();
      await expect(service.requestOtp({phoneNumber: 'bad'})).rejects.toThrow(
        'Invalid phone number format.',
      );
    });

    it('throws SautiError on too many requests', async () => {
      mockSignInWithPhoneNumber.mockRejectedValueOnce(
        Object.assign(new Error('Too many'), {code: 'auth/too-many-requests'}),
      );

      const service = new FirebasePhoneAuthService();
      await expect(service.requestOtp({phoneNumber: '+2348012345678'})).rejects.toThrow(
        'Too many attempts',
      );
    });

    it('throws SautiError on network failure', async () => {
      mockSignInWithPhoneNumber.mockRejectedValueOnce(
        Object.assign(new Error('Network'), {code: 'auth/network-request-failed'}),
      );

      const service = new FirebasePhoneAuthService();
      await expect(service.requestOtp({phoneNumber: '+2348012345678'})).rejects.toThrow(
        'Network connection unavailable',
      );
    });
  });

  describe('verifyOtp', () => {
    it('confirms the verification code after requestOtp', async () => {
      const service = new FirebasePhoneAuthService();
      await service.requestOtp({phoneNumber: '+2348012345678'});

      const result = await service.verifyOtp({
        phoneNumber: '+2348012345678',
        otpCode: '123456',
      });

      expect(mockConfirm).toHaveBeenCalledWith('123456');
      expect(result.verified).toBe(true);
      expect(result.firebaseIdToken).toBe('mock-firebase-id-token');
      expect(mockGetIdToken).toHaveBeenCalled();
    });

    it('signs out of Firebase after successful verification', async () => {
      const service = new FirebasePhoneAuthService();
      await service.requestOtp({phoneNumber: '+2348012345678'});
      await service.verifyOtp({phoneNumber: '+2348012345678', otpCode: '123456'});

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('throws when verifyOtp is called without requestOtp', async () => {
      const service = new FirebasePhoneAuthService();

      await expect(
        service.verifyOtp({phoneNumber: '+2348012345678', otpCode: '123456'}),
      ).rejects.toThrow('No pending verification');
    });

    it('throws SautiError on invalid verification code', async () => {
      mockConfirm.mockRejectedValueOnce(
        Object.assign(new Error('Bad code'), {code: 'auth/invalid-verification-code'}),
      );

      const service = new FirebasePhoneAuthService();
      await service.requestOtp({phoneNumber: '+2348012345678'});

      await expect(
        service.verifyOtp({phoneNumber: '+2348012345678', otpCode: '000000'}),
      ).rejects.toThrow('The verification code is incorrect.');
    });

    it('throws SautiError on expired session', async () => {
      mockConfirm.mockRejectedValueOnce(
        Object.assign(new Error('Expired'), {code: 'auth/session-expired'}),
      );

      const service = new FirebasePhoneAuthService();
      await service.requestOtp({phoneNumber: '+2348012345678'});

      await expect(
        service.verifyOtp({phoneNumber: '+2348012345678', otpCode: '123456'}),
      ).rejects.toThrow('Verification session expired');
    });
  });
});
