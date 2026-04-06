import {SautiError} from '../matrix/MatrixClient';
import {NativeModules} from 'react-native';

import Config from 'react-native-config';

export interface MatrixEnvConfig {
  matrixHomeserverUrl: string;
  matrixHomeserverDomain: string;
}

export interface ProxyEnvConfig {
  frontingHost: string;
  originHost: string;
  frontingPublicKeyHashes: string[];
}

export interface SupabaseEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseEmailRedirectUrl?: string;
}

export type EnvSource = Record<string, string | undefined>;

const DEV_FALLBACK_ENV: EnvSource = {
  MATRIX_HOMESERVER_URL: 'https://matrix.sauti.ru',
  MATRIX_HOMESERVER_DOMAIN: 'matrix.sauti.ru',
  CF_FRONTING_HOST: 'cdn.cloudflare.com',
  CF_ORIGIN_HOST: 'matrix.sauti.ru',
  CF_FRONTING_PUBLIC_KEY_HASHES:
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=,BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  SUPABASE_URL: 'https://pcvysozwnegddinktcjd.supabase.co',
  SUPABASE_EMAIL_REDIRECT_URL: 'https://matrix.sauti.ru',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdnlzb3p3bmVnZGRpbmt0Y2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjA3MTMsImV4cCI6MjA5MDgzNjcxM30.LwBCn6bKgFFFOZTySFtRl78DEw3Hmylov1yQEWhUcDY',
};

// Returns true only if the source looks like a real app env (has a known key).
// react-native-config without dotenv.gradle returns standard BuildConfig fields
// (DEBUG, APPLICATION_ID, etc.) which must not be mistaken for a real env source.
function isAppEnvSource(source: unknown): source is EnvSource {
  if (!source || typeof source !== 'object') {
    return false;
  }
  const s = source as Record<string, unknown>;
  return typeof s['SUPABASE_URL'] === 'string' && s['SUPABASE_URL'].length > 0;
}

function readDefaultEnvSource(): EnvSource {
  if (isAppEnvSource(Config)) {
    return Config as unknown as EnvSource;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require('react-native-config') as
      | EnvSource
      | {default?: EnvSource};

    const inner = (loaded as {default?: EnvSource}).default ?? (loaded as EnvSource);
    if (isAppEnvSource(inner)) {
      return inner as EnvSource;
    }
  } catch {
    // fall through
  }

  if (__DEV__) {
    return DEV_FALLBACK_ENV;
  }

  return {};
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

function isLikelySha256Base64Pin(value: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(value);
}

function parseFrontingPinHashes(raw: string): string[] {
  const pins = raw
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0);

  if (pins.length < 2) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'CF_FRONTING_PUBLIC_KEY_HASHES must include at least two comma-separated pins.',
    );
  }

  for (const pin of pins) {
    if (!isLikelySha256Base64Pin(pin)) {
      throw new SautiError(
        'MATRIX_CONFIG_INVALID',
        'Invalid pin format in CF_FRONTING_PUBLIC_KEY_HASHES.',
      );
    }
  }

  return pins;
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
  const frontingPublicKeyHashes = source.CF_FRONTING_PUBLIC_KEY_HASHES?.trim();

  if (!frontingHost && !originHost && !frontingPublicKeyHashes) {
    return null;
  }

  if (!frontingHost || !originHost || !frontingPublicKeyHashes) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'Proxy env must define CF_FRONTING_HOST, CF_ORIGIN_HOST, and CF_FRONTING_PUBLIC_KEY_HASHES.',
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
    frontingPublicKeyHashes: parseFrontingPinHashes(frontingPublicKeyHashes),
  };
}

export function readSupabaseEnv(
  source: EnvSource = readDefaultEnvSource(),
): SupabaseEnvConfig {
  const redirectUrl = source.SUPABASE_EMAIL_REDIRECT_URL?.trim();

  if (redirectUrl && !isHttpsUrl(redirectUrl)) {
    throw new SautiError(
      'MATRIX_CONFIG_INVALID',
      'Invalid env value for key: SUPABASE_EMAIL_REDIRECT_URL',
    );
  }

  return {
    supabaseUrl: mustReadString(source, 'SUPABASE_URL', isHttpsUrl),
    supabaseAnonKey: mustReadString(source, 'SUPABASE_ANON_KEY'),
    supabaseEmailRedirectUrl: redirectUrl && redirectUrl.length > 0 ? redirectUrl : undefined,
  };
}
