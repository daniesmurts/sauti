import {readSupabaseFunctionEnv} from './env.ts';

export interface MatrixProvisioningResponse {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs?: number;
}

export interface MatrixProvisioningInput {
  phoneNumber: string;
  password: string;
  displayName?: string;
}

export interface MatrixProvisioningGatewayLike {
  registerUser(input: MatrixProvisioningInput): Promise<{
    userId: string;
    accessToken: string;
    deviceId?: string;
    refreshToken?: string;
    expiresInMs: number;
  }>;
}

interface MatrixLoginResponse {
  user_id?: string;
  access_token?: string;
  device_id?: string;
  refresh_token?: string;
  expires_in_ms?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isProvisioningResponse(value: unknown): value is MatrixProvisioningResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.userId === 'string' &&
    typeof value.accessToken === 'string' &&
    (typeof value.deviceId === 'undefined' || typeof value.deviceId === 'string') &&
    (typeof value.refreshToken === 'undefined' ||
      typeof value.refreshToken === 'string') &&
    (typeof value.expiresInMs === 'undefined' || typeof value.expiresInMs === 'number')
  );
}

function isMatrixLoginResponse(value: unknown): value is MatrixLoginResponse {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.user_id === 'string' &&
    typeof value.access_token === 'string' &&
    (typeof value.device_id === 'undefined' || typeof value.device_id === 'string') &&
    (typeof value.refresh_token === 'undefined' || typeof value.refresh_token === 'string') &&
    (typeof value.expires_in_ms === 'undefined' || typeof value.expires_in_ms === 'number')
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function normalizeMsisdn(value: string): string {
  return value.replace(/\D/g, '');
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildMatrixUserId(
  phoneNumber: string,
  homeserverDomain: string,
): Promise<string> {
  const digest = await sha256Hex(normalizePhoneNumber(phoneNumber));
  const localpart = `u_${digest.slice(0, 24)}`;

  return `@${localpart}:${homeserverDomain}`;
}

async function assertOk(response: Response, messagePrefix: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await readTextSafe(response);
  throw new Error(`${messagePrefix} (${response.status}): ${body}`);
}

async function registerViaAdminApi(
  fetchFn: typeof fetch,
  input: MatrixProvisioningInput,
): Promise<{
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs: number;
}> {
  const env = readSupabaseFunctionEnv();

  if (
    !env.matrixHomeserverUrl ||
    !env.matrixHomeserverDomain ||
    !env.matrixProvisioningApiToken
  ) {
    throw new Error(
      'Matrix admin provisioning is not configured. Set MATRIX_HOMESERVER_URL, MATRIX_HOMESERVER_DOMAIN, and MATRIX_PROVISIONING_API_TOKEN.',
    );
  }

  const homeserverUrl = trimTrailingSlash(env.matrixHomeserverUrl);
  const userId = await buildMatrixUserId(
    input.phoneNumber,
    env.matrixHomeserverDomain,
  );

  const createUserResponse = await fetchFn(
    `${homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.matrixProvisioningApiToken}`,
      },
      body: JSON.stringify({
        password: input.password,
        displayname: input.displayName,
        admin: false,
        deactivated: false,
        logout_devices: false,
        threepids: [
          {
            medium: 'msisdn',
            address: normalizeMsisdn(input.phoneNumber),
          },
        ],
      }),
    },
  );

  await assertOk(
    createUserResponse,
    'Matrix admin create-user request failed. Ensure the homeserver exposes /_synapse/admin and the admin token is valid',
  );

  const loginResponse = await fetchFn(`${homeserverUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'm.login.password',
      user: userId,
      identifier: {
        type: 'm.id.user',
        user: userId,
      },
      password: input.password,
      initial_device_display_name: 'Sauti',
      refresh_token: true,
    }),
  });

  await assertOk(loginResponse, 'Matrix password login failed after account creation');

  const payload = await readJsonSafe(loginResponse);
  if (!isMatrixLoginResponse(payload)) {
    throw new Error('Matrix login payload is invalid.');
  }

  return {
    userId: payload.user_id,
    accessToken: payload.access_token,
    deviceId: payload.device_id,
    refreshToken: payload.refresh_token,
    expiresInMs: payload.expires_in_ms ?? 24 * 60 * 60 * 1000,
  };
}

async function readJsonSafe(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export function createMatrixProvisioningGateway(
  fetchFn: typeof fetch = fetch,
): MatrixProvisioningGatewayLike {
  const env = readSupabaseFunctionEnv();

  return {
    async registerUser(input) {
      if (
        env.matrixHomeserverUrl &&
        env.matrixHomeserverDomain &&
        env.matrixProvisioningApiToken
      ) {
        return registerViaAdminApi(fetchFn, input);
      }

      if (!env.matrixProvisioningApiUrl) {
        throw new Error(
          'Matrix provisioning integration not configured. Set MATRIX_HOMESERVER_URL, MATRIX_HOMESERVER_DOMAIN, and MATRIX_PROVISIONING_API_TOKEN for direct admin provisioning, or MATRIX_PROVISIONING_API_URL for a separate provisioning service.',
        );
      }

      const response = await fetchFn(env.matrixProvisioningApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.matrixProvisioningApiToken
            ? {Authorization: `Bearer ${env.matrixProvisioningApiToken}`}
            : {}),
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const body = await readTextSafe(response);
        throw new Error(
          `Matrix provisioning request failed (${response.status}): ${body}`,
        );
      }

      const payload = await readJsonSafe(response);
      if (!isProvisioningResponse(payload)) {
        throw new Error('Matrix provisioning payload is invalid.');
      }

      return {
        userId: payload.userId,
        accessToken: payload.accessToken,
        deviceId: payload.deviceId,
        refreshToken: payload.refreshToken,
        expiresInMs: payload.expiresInMs ?? 24 * 60 * 60 * 1000,
      };
    },
  };
}