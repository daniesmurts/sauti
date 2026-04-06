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
      if (!env.matrixProvisioningApiUrl) {
        throw new Error(
          'Matrix provisioning integration not configured. Set MATRIX_PROVISIONING_API_URL to a service that creates Matrix users and returns credentials.',
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