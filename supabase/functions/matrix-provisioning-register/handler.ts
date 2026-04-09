export interface MatrixProvisioningRequest {
  phoneNumber: string;
  password: string;
  displayName?: string;
}

export interface MatrixProvisioningResult {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRequest(value: unknown): value is MatrixProvisioningRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.phoneNumber === 'string' &&
    typeof value.password === 'string' &&
    (typeof value.displayName === 'undefined' || typeof value.displayName === 'string')
  );
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function normalizeHomeserverUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeServerName(value: string): string {
  return value.replace(/^@/, '').trim();
}

function parseErrcode(payload: unknown): string | undefined {
  if (!isObject(payload)) {
    return undefined;
  }

  return typeof payload.errcode === 'string' ? payload.errcode : undefined;
}

function parseLoginResponse(payload: unknown): {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
  expiresInMs: number;
} {
  if (!isObject(payload)) {
    throw new Error('Matrix login payload is invalid.');
  }

  const userId = payload.user_id;
  const accessToken = payload.access_token;
  const deviceId = payload.device_id;
  const refreshToken = payload.refresh_token;
  const expiresInMs = payload.expires_in_ms;

  if (typeof userId !== 'string' || typeof accessToken !== 'string') {
    throw new Error('Matrix login payload is missing user_id/access_token.');
  }

  if (typeof deviceId !== 'undefined' && typeof deviceId !== 'string') {
    throw new Error('Matrix login payload has invalid device_id.');
  }

  if (typeof refreshToken !== 'undefined' && typeof refreshToken !== 'string') {
    throw new Error('Matrix login payload has invalid refresh_token.');
  }

  if (typeof expiresInMs !== 'undefined' && typeof expiresInMs !== 'number') {
    throw new Error('Matrix login payload has invalid expires_in_ms.');
  }

  return {
    userId,
    accessToken,
    deviceId,
    refreshToken,
    expiresInMs: expiresInMs ?? 24 * 60 * 60 * 1000,
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

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildLocalpart(phoneNumber: string): Promise<string> {
  const digest = await sha256Hex(normalizePhoneNumber(phoneNumber));
  return `u_${digest.slice(0, 24)}`;
}

export interface CreateProvisioningHandlerOptions {
  fetchFn?: typeof fetch;
  matrixClientApiUrl: string;
  matrixServerName: string;
  matrixRegistrationToken?: string;
}

export function createProvisioningHandler(options: CreateProvisioningHandlerOptions) {
  const fetchFn = options.fetchFn ?? fetch;
  const homeserverUrl = normalizeHomeserverUrl(options.matrixClientApiUrl);
  const serverName = normalizeServerName(options.matrixServerName);

  return async function handleProvisioning(
    requestBody: unknown,
  ): Promise<MatrixProvisioningResult> {
    if (!isRequest(requestBody)) {
      throw new Error('Invalid provisioning payload.');
    }

    const phoneNumber = normalizePhoneNumber(requestBody.phoneNumber.trim());
    const password = requestBody.password.trim();
    const displayName = requestBody.displayName?.trim() || undefined;

    if (!phoneNumber) {
      throw new Error('phoneNumber is required.');
    }

    if (password.length < 8) {
      throw new Error('password must be at least 8 characters.');
    }

    const localpart = await buildLocalpart(phoneNumber);
    const userId = `@${localpart}:${serverName}`;

    const registerPayload: Record<string, unknown> = {
      username: localpart,
      password,
      inhibit_login: true,
    };

    if (displayName) {
      registerPayload.initial_device_display_name = displayName;
    }

    if (options.matrixRegistrationToken) {
      registerPayload.auth = {
        type: 'm.login.registration_token',
        token: options.matrixRegistrationToken,
      };
    } else {
      registerPayload.auth = {
        type: 'm.login.dummy',
      };
    }

    const registerResponse = await fetchFn(
      `${homeserverUrl}/_matrix/client/v3/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerPayload),
      },
    );

    if (!registerResponse.ok) {
      const registerJson = await readJsonSafe(registerResponse);
      const errcode = parseErrcode(registerJson);

      if (errcode !== 'M_USER_IN_USE') {
        const registerText =
          registerJson !== null ? JSON.stringify(registerJson) : await readTextSafe(registerResponse);
        throw new Error(
          `Matrix register request failed (${registerResponse.status}): ${registerText}`,
        );
      }
    }

    const loginResponse = await fetchFn(`${homeserverUrl}/_matrix/client/v3/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId,
        },
        password,
        initial_device_display_name: 'Sauti',
        refresh_token: true,
      }),
    });

    if (!loginResponse.ok) {
      const loginText = await readTextSafe(loginResponse);
      throw new Error(
        `Matrix login failed after register (${loginResponse.status}): ${loginText}`,
      );
    }

    const loginJson = await readJsonSafe(loginResponse);
    const login = parseLoginResponse(loginJson);

    return {
      userId: login.userId,
      accessToken: login.accessToken,
      deviceId: login.deviceId,
      refreshToken: login.refreshToken,
      expiresInMs: login.expiresInMs,
    };
  };
}
