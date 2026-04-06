import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readSupabaseFunctionEnv} from '../_shared/env.ts';
import {readJsonObject} from '../_shared/http.ts';
import {postgrestInsert} from '../_shared/postgrest.ts';
import {
  createRequestOtpHandler,
  type OtpRequestGateway,
  type OtpRequestRepository,
} from './handler.ts';

const env = readSupabaseFunctionEnv();

const gateway: OtpRequestGateway = {
  async requestOtp() {
    if (!env.otpTestCode) {
      throw new Error(
        'OTP provider request integration not configured. Set SAUTI_TEST_OTP_CODE for local OTP testing or wire a production provider.',
      );
    }

    return {
      providerRequestId: crypto.randomUUID(),
      expiresInSeconds: 300,
    };
  },
};

const repository: OtpRequestRepository = {
  async createRequest(input) {
    await postgrestInsert('otp_verification_requests', {
      request_id: input.requestId,
      phone_number: input.phoneNumber,
      provider_request_id: input.providerRequestId ?? null,
      expires_at: input.expiresAt ?? null,
    });
  },
};

const handler = createRequestOtpHandler({
  gateway,
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