import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readJsonObject} from '../_shared/http.ts';
import {createProvisioningHandler} from './handler.ts';

function readRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const matrixClientApiUrl = readRequiredEnv('MATRIX_CLIENT_API_URL');
const matrixServerName = readRequiredEnv('MATRIX_SERVER_NAME');
const matrixRegistrationToken = Deno.env.get('MATRIX_REGISTRATION_TOKEN')?.trim();
const expectedBearerToken = Deno.env.get('MATRIX_PROVISIONING_API_TOKEN')?.trim();

const handler = createProvisioningHandler({
  matrixClientApiUrl,
  matrixServerName,
  matrixRegistrationToken: matrixRegistrationToken && matrixRegistrationToken.length > 0
    ? matrixRegistrationToken
    : undefined,
});

serve(async request => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({error: 'Method not allowed.'}), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (expectedBearerToken) {
    const authHeader = request.headers.get('authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || token !== expectedBearerToken) {
      return new Response(JSON.stringify({error: 'Unauthorized.'}), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  try {
    const body = readJsonObject(await request.text());
    const result = await handler(body);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';

    return new Response(JSON.stringify({error: message}), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
});
