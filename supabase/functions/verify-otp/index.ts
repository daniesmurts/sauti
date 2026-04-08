import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readSupabaseFunctionEnv} from '../_shared/env.ts';
import {readJsonObject} from '../_shared/http.ts';
import {postgrestSelectSingle, postgrestUpdate} from '../_shared/postgrest.ts';
import {
  createVerifyOtpHandler,
  type OtpVerificationRequestRecord,
  type OtpVerificationGateway,
  type OtpVerificationRepository,
} from './handler.ts';

const env = readSupabaseFunctionEnv();

const gateway: OtpVerificationGateway = {
  async verifyOtp(input) {
    // Production path: call real OTP provider API (e.g. Twilio Verify)
    if (env.otpProviderUrl) {
      const response = await fetch(env.otpProviderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.otpProviderApiKey ? {'Authorization': `Bearer ${env.otpProviderApiKey}`} : {}),
        },
        body: JSON.stringify({
          phoneNumber: input.phoneNumber,
          otpCode: input.otpCode,
          providerRequestId: input.providerRequestId,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json() as {verified?: boolean};
      return result.verified === true;
    }

    // Test mode: accept hardcoded test code for local development
    if (env.otpTestCode) {
      return input.otpCode === env.otpTestCode;
    }

    throw new Error(
      'OTP provider not configured. Set OTP_PROVIDER_URL for production or SAUTI_TEST_OTP_CODE for local testing.',
    );
  },
};

const repository: OtpVerificationRepository = {
  async findRequestById(requestId) {
    const row = await postgrestSelectSingle<{
      request_id: string;
      phone_number: string;
      provider_request_id?: string | null;
      expires_at?: string | null;
      verified_at?: string | null;
    }>('otp_verification_requests', {request_id: requestId}, 'request_id,phone_number,provider_request_id,expires_at,verified_at');

    if (!row) {
      return null;
    }

    const result: OtpVerificationRequestRecord = {
      requestId: row.request_id,
      phoneNumber: row.phone_number,
      providerRequestId: row.provider_request_id ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      verifiedAt: row.verified_at ?? undefined,
    };

    return result;
  },
  async markVerified(input) {
    await postgrestUpdate(
      'otp_verification_requests',
      {request_id: input.requestId},
      {verified_at: input.verifiedAt},
    );
  },
};

const handler = createVerifyOtpHandler({
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