import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readJsonObject} from '../_shared/http';
import {
  createRegisterMatrixUserHandler,
  type MatrixProvisioningGateway,
  type MatrixRegistrationRepository,
  type OtpVerificationGateway,
} from './handler';

const otpVerifier: OtpVerificationGateway = {
  async verifyOtp() {
    throw new Error('OTP provider integration not configured.');
  },
};

const matrixGateway: MatrixProvisioningGateway = {
  async registerUser() {
    throw new Error('Matrix provisioning integration not configured.');
  },
};

const repository: MatrixRegistrationRepository = {
  async upsertRegistration() {
    throw new Error('Supabase repository integration not configured.');
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
