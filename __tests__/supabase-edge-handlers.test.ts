import {
  createRegisterMatrixUserHandler,
  type RegisterMatrixUserResult,
} from '../supabase/functions/register-matrix-user/handler';
import {createRequestOtpHandler} from '../supabase/functions/request-otp/handler';
import {createSubscriptionStatusHandler} from '../supabase/functions/subscription-status/handler';
import {createVerifyOtpHandler} from '../supabase/functions/verify-otp/handler';

describe('Supabase edge handlers', () => {
  describe('request-otp handler', () => {
    it('requests otp delivery and persists the issued request id', async () => {
      const repository = {
        createRequest: jest.fn(async () => undefined),
      };

      const handler = createRequestOtpHandler({
        gateway: {
          requestOtp: jest.fn(async () => ({
            providerRequestId: 'provider-request-1',
            expiresInSeconds: 300,
          })),
        },
        repository,
        generateRequestId: () => 'otp-request-1',
        now: () => new Date('2026-04-06T11:30:00.000Z'),
      });

      const response = await handler({phoneNumber: '+234 801 234 5678'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        requestId: 'otp-request-1',
        expiresInSeconds: 300,
      });
      expect(repository.createRequest).toHaveBeenCalledWith({
        requestId: 'otp-request-1',
        phoneNumber: '+2348012345678',
        providerRequestId: 'provider-request-1',
        expiresAt: '2026-04-06T11:35:00.000Z',
      });
    });

    it('rejects malformed phone numbers', async () => {
      const handler = createRequestOtpHandler({
        gateway: {
          requestOtp: jest.fn(async () => ({expiresInSeconds: 300})),
        },
        repository: {
          createRequest: jest.fn(async () => undefined),
        },
      });

      const response = await handler({phoneNumber: '123'});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Phone number must be in international format.',
      });
    });
  });

  describe('register-matrix-user handler', () => {
    it('registers a Matrix user after OTP verification and persists the mapping', async () => {
      const repository = {
        upsertRegistration: jest.fn(async () => undefined),
      };
      const matrixResult: RegisterMatrixUserResult = {
        userId: '@kwame:sauti.app',
        accessToken: 'access-token',
        deviceId: 'device-1',
        refreshToken: 'refresh-token',
        expiresInMs: 3600000,
      };

      const handler = createRegisterMatrixUserHandler({
        otpVerifier: {
          verifyOtp: jest.fn(async () => true),
        },
        matrixGateway: {
          registerUser: jest.fn(async () => matrixResult),
        },
        repository,
      });

      const response = await handler({
        phoneNumber: '+234 801 234 5678',
        otpCode: '123456',
        password: 'strong-password',
        displayName: 'Kwame Asante',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(matrixResult);
      expect(repository.upsertRegistration).toHaveBeenCalledWith({
        phoneNumber: '+2348012345678',
        matrixUserId: '@kwame:sauti.app',
        displayName: 'Kwame Asante',
        lastDeviceId: 'device-1',
      });
    });

    it('rejects invalid OTP verification', async () => {
      const handler = createRegisterMatrixUserHandler({
        otpVerifier: {
          verifyOtp: jest.fn(async () => false),
        },
        matrixGateway: {
          registerUser: jest.fn(async () => {
            throw new Error('should not run');
          }),
        },
        repository: {
          upsertRegistration: jest.fn(async () => undefined),
        },
      });

      const response = await handler({
        phoneNumber: '+2348012345678',
        otpCode: '123456',
        password: 'strong-password',
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({error: 'OTP verification failed.'});
    });
  });

  describe('verify-otp handler', () => {
    it('verifies otp and marks the request as consumed', async () => {
      const repository = {
        findRequestById: jest.fn(async () => ({
          requestId: 'otp-request-1',
          phoneNumber: '+2348012345678',
          providerRequestId: 'provider-request-1',
          expiresAt: '2026-04-06T11:35:00.000Z',
        })),
        markVerified: jest.fn(async () => undefined),
      };

      const handler = createVerifyOtpHandler({
        gateway: {
          verifyOtp: jest.fn(async () => true),
        },
        repository,
        now: () => new Date('2026-04-06T11:31:00.000Z'),
      });

      const response = await handler({
        phoneNumber: '+234 801 234 5678',
        otpCode: '123456',
        requestId: 'otp-request-1',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({verified: true});
      expect(repository.markVerified).toHaveBeenCalledWith({
        requestId: 'otp-request-1',
        verifiedAt: '2026-04-06T11:31:00.000Z',
      });
    });

    it('rejects expired requests before reaching the provider', async () => {
      const gateway = {
        verifyOtp: jest.fn(async () => true),
      };
      const handler = createVerifyOtpHandler({
        gateway,
        repository: {
          findRequestById: jest.fn(async () => ({
            requestId: 'otp-request-1',
            phoneNumber: '+2348012345678',
            expiresAt: '2026-04-06T11:29:59.000Z',
          })),
          markVerified: jest.fn(async () => undefined),
        },
        now: () => new Date('2026-04-06T11:31:00.000Z'),
      });

      const response = await handler({
        phoneNumber: '+2348012345678',
        otpCode: '123456',
        requestId: 'otp-request-1',
      });

      expect(response.status).toBe(410);
      expect(response.body).toEqual({error: 'OTP request has expired.'});
      expect(gateway.verifyOtp).not.toHaveBeenCalled();
    });
  });

  describe('subscription-status handler', () => {
    it('returns stored subscription state for a known user', async () => {
      const handler = createSubscriptionStatusHandler({
        findByMatrixUserId: jest.fn(async matrixUserId => ({
          matrixUserId,
          plan: 'family',
          status: 'active',
          currentPeriodEnd: '2026-05-01T00:00:00.000Z',
        })),
      });

      const response = await handler({matrixUserId: '@kwame:sauti.app'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        matrixUserId: '@kwame:sauti.app',
        plan: 'family',
        status: 'active',
        currentPeriodEnd: '2026-05-01T00:00:00.000Z',
      });
    });

    it('defaults to free active when no subscription record exists', async () => {
      const handler = createSubscriptionStatusHandler({
        findByMatrixUserId: jest.fn(async () => null),
      });

      const response = await handler({matrixUserId: '@new-user:sauti.app'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        matrixUserId: '@new-user:sauti.app',
        plan: 'free',
        status: 'active',
      });
    });
  });
});