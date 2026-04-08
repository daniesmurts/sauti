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
  async requestOtp(input) {
    // Production path: call real OTP provider API (e.g. Twilio Verify)
    if (env.otpProviderUrl) {
      const response = await fetch(env.otpProviderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.otpProviderApiKey ? {'Authorization': `Bearer ${env.otpProviderApiKey}`} : {}),
        },
        body: JSON.stringify({phoneNumber: input.phoneNumber}),
      });

      if (!response.ok) {
        throw new Error(`OTP provider returned status ${response.status}`);
      }

      const result = await response.json() as {providerRequestId?: string; expiresInSeconds?: number};
      return {
        providerRequestId: result.providerRequestId ?? crypto.randomUUID(),
        expiresInSeconds: result.expiresInSeconds ?? 300,
      };
    }

    // Test mode: accept hardcoded test code for local development
    if (env.otpTestCode) {
      return {
        providerRequestId: crypto.randomUUID(),
        expiresInSeconds: 300,
      };
    }

    throw new Error(
      'OTP provider not configured. Set OTP_PROVIDER_URL for production or SAUTI_TEST_OTP_CODE for local testing.',
    );
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