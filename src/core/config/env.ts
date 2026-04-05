import {SautiError} from '../matrix/MatrixClient';

export interface MatrixEnvConfig {
  matrixHomeserverUrl: string;
  matrixHomeserverDomain: string;
}

export interface ProxyEnvConfig {
  frontingHost: string;
  originHost: string;
}

export interface SupabaseEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type EnvSource = Record<string, string | undefined>;

function readDefaultEnvSource(): EnvSource {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require('react-native-config') as {default?: EnvSource};
    return loaded.default ?? {};
  } catch {
    return {};
  }
}

function mustReadString(
  source: EnvSource,
  key: string,
  validate?: (value: string) => boolean,
): string {
  const value = source[key];

  if (!value || value.trim() === '') {
    throw new SautiError('MATRIX_CONFIG_INVALID', `Missing required env key: ${key}`);
  }

  if (validate && !validate(value)) {
    throw new SautiError('MATRIX_CONFIG_INVALID', `Invalid env value for key: ${key}`);
  }

  return value;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLikelyDomain(value: string): boolean {
  return /^[a-z0-9.-]+$/i.test(value) && value.includes('.');
}

export function readMatrixEnv(source: EnvSource = readDefaultEnvSource()): MatrixEnvConfig {
  return {
    matrixHomeserverUrl: mustReadString(source, 'MATRIX_HOMESERVER_URL', isHttpsUrl),
    matrixHomeserverDomain: mustReadString(
      source,
      'MATRIX_HOMESERVER_DOMAIN',
      isLikelyDomain,
    ),
  };
}

export function readProxyEnv(
  source: EnvSource = readDefaultEnvSource(),
): ProxyEnvConfig | null {
  const frontingHost = source.CF_FRONTING_HOST?.trim();
  const originHost = source.CF_ORIGIN_HOST?.trim();

  if (!frontingHost && !originHost) {
    return null;
  }

  if (!frontingHost || !originHost) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'Proxy env must define both CF_FRONTING_HOST and CF_ORIGIN_HOST.',
    );
  }

  if (!isLikelyDomain(frontingHost)) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'Invalid env value for key: CF_FRONTING_HOST',
    );
  }

  if (!isLikelyDomain(originHost)) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'Invalid env value for key: CF_ORIGIN_HOST',
    );
  }

  return {
    frontingHost,
    originHost,
  };
}

export function readSupabaseEnv(
  source: EnvSource = readDefaultEnvSource(),
): SupabaseEnvConfig {
  return {
    supabaseUrl: mustReadString(source, 'SUPABASE_URL', isHttpsUrl),
    supabaseAnonKey: mustReadString(source, 'SUPABASE_ANON_KEY'),
  };
}
