import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readSupabaseFunctionEnv} from '../_shared/env.ts';
import {readJsonObject} from '../_shared/http.ts';
import {createMatrixProvisioningGateway} from '../_shared/matrixProvisioning.ts';
import {postgrestInsert} from '../_shared/postgrest.ts';
import {
  createRegisterMatrixUserHandler,
  type MatrixRegistrationRepository,
  type OtpVerificationGateway,
} from './handler.ts';

const env = readSupabaseFunctionEnv();

const otpVerifier: OtpVerificationGateway = {
  async verifyOtp(input) {
    if (!env.otpTestCode) {
      throw new Error(
        'OTP provider integration not configured. Set SAUTI_TEST_OTP_CODE for local OTP testing or wire a production provider.',
      );
    }

    return input.otpCode === env.otpTestCode;
  },
};

const matrixGateway = createMatrixProvisioningGateway();

const repository: MatrixRegistrationRepository = {
  async upsertRegistration(input) {
    await postgrestInsert(
      'matrix_registrations',
      {
        phone_number: input.phoneNumber,
        matrix_user_id: input.matrixUserId,
        display_name: input.displayName ?? null,
        last_device_id: input.lastDeviceId ?? null,
      },
      {
        upsert: true,
        onConflict: 'phone_number',
      },
    );
  },
};

const handler = createRegisterMatrixUserHandler({
  otpVerifier,
  matrixGateway,
  repository,
});

serve(async request => {
  const body = readJsonObject(await request.text());
  const result = await handler(body);

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
});
