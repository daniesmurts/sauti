import {
  createRegisterMatrixUserHandler,
  type RegisterMatrixUserResult,
} from '../supabase/functions/register-matrix-user/handler';
import {createSubscriptionStatusHandler} from '../supabase/functions/subscription-status/handler';

describe('Supabase edge handlers', () => {
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