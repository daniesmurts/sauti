import {readMatrixEnv, readProxyEnv, readSupabaseEnv} from '../src/core/config/env';

describe('readMatrixEnv', () => {
  it('reads and validates Matrix env values', () => {
    const config = readMatrixEnv({
      MATRIX_HOMESERVER_URL: 'https://matrix.example.org',
      MATRIX_HOMESERVER_DOMAIN: 'example.org',
    });

    expect(config).toEqual({
      matrixHomeserverUrl: 'https://matrix.example.org',
      matrixHomeserverDomain: 'example.org',
    });
  });

  it('throws typed error when homeserver URL is missing', () => {
    expect(() =>
      readMatrixEnv({
        MATRIX_HOMESERVER_DOMAIN: 'example.org',
      }),
    ).toThrow(expect.objectContaining({code: 'MATRIX_CONFIG_INVALID'}));
  });

  it('throws typed error when homeserver URL is not https', () => {
    expect(() =>
      readMatrixEnv({
        MATRIX_HOMESERVER_URL: 'http://matrix.example.org',
        MATRIX_HOMESERVER_DOMAIN: 'example.org',
      }),
    ).toThrow(expect.objectContaining({code: 'MATRIX_CONFIG_INVALID'}));
  });
});

describe('readProxyEnv', () => {
  it('returns null when proxy env values are absent', () => {
    expect(readProxyEnv({})).toBeNull();
  });

  it('reads valid fronting env values', () => {
    expect(
      readProxyEnv({
        CF_FRONTING_HOST: 'cdn.cloudflare.com',
        CF_ORIGIN_HOST: 'matrix.example.org',
        CF_FRONTING_PUBLIC_KEY_HASHES:
          'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=,hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
      }),
    ).toEqual({
      frontingHost: 'cdn.cloudflare.com',
      originHost: 'matrix.example.org',
      frontingPublicKeyHashes: [
        'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
        'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
      ],
    });
  });

  it('throws typed error when one fronting key is missing', () => {
    expect(() =>
      readProxyEnv({
        CF_FRONTING_HOST: 'cdn.cloudflare.com',
      }),
    ).toThrow(expect.objectContaining({code: 'MATRIX_CONFIG_INVALID'}));
  });

  it('throws typed error when pin list has fewer than two values', () => {
    expect(() =>
      readProxyEnv({
        CF_FRONTING_HOST: 'cdn.cloudflare.com',
        CF_ORIGIN_HOST: 'matrix.example.org',
        CF_FRONTING_PUBLIC_KEY_HASHES:
          'CLOmM1/OXvSPjw5UOYbAf9GKOxImEp9hhku9W90fHMk=',
      }),
    ).toThrow(expect.objectContaining({code: 'MATRIX_CONFIG_INVALID'}));
  });
});

describe('readSupabaseEnv', () => {
  it('reads and validates Supabase env values', () => {
    expect(
      readSupabaseEnv({
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('throws typed error when Supabase URL is missing', () => {
    expect(() =>
      readSupabaseEnv({
        SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toThrow(expect.objectContaining({code: 'MATRIX_CONFIG_INVALID'}));
  });
});
