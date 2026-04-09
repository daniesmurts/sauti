export interface SupabaseFunctionEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  otpTestCode?: string;
  /** URL for production OTP provider (e.g. Twilio Verify endpoint). When set, overrides test-code mode. */
  otpProviderUrl?: string;
  /** Auth token/key for the OTP provider API. */
  otpProviderApiKey?: string;
  matrixHomeserverUrl?: string;
  matrixHomeserverDomain?: string;
  matrixProvisioningApiUrl?: string;
  matrixProvisioningApiToken?: string;
  /** Firebase Web API key used to verify Firebase ID tokens via the REST API. */
  firebaseWebApiKey?: string;
}

function mustReadEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readSupabaseFunctionEnv(): SupabaseFunctionEnv {
  const otpTestCode = Deno.env.get('SAUTI_TEST_OTP_CODE')?.trim();
  const otpProviderUrl = Deno.env.get('OTP_PROVIDER_URL')?.trim();
  const otpProviderApiKey = Deno.env.get('OTP_PROVIDER_API_KEY')?.trim();
  const matrixHomeserverUrl = Deno.env.get('MATRIX_HOMESERVER_URL')?.trim();
  const matrixHomeserverDomain = Deno.env.get('MATRIX_HOMESERVER_DOMAIN')?.trim();
  const matrixProvisioningApiUrl = Deno.env
    .get('MATRIX_PROVISIONING_API_URL')
    ?.trim();
  const matrixProvisioningApiToken = Deno.env
    .get('MATRIX_PROVISIONING_API_TOKEN')
    ?.trim();
  const firebaseWebApiKey = Deno.env.get('FIREBASE_WEB_API_KEY')?.trim();

  return {
    supabaseUrl: mustReadEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: mustReadEnv('SUPABASE_SERVICE_ROLE_KEY'),
    otpTestCode: otpTestCode && otpTestCode.length > 0 ? otpTestCode : undefined,
    otpProviderUrl: otpProviderUrl && otpProviderUrl.length > 0 ? otpProviderUrl : undefined,
    otpProviderApiKey: otpProviderApiKey && otpProviderApiKey.length > 0 ? otpProviderApiKey : undefined,
    matrixHomeserverUrl:
      matrixHomeserverUrl && matrixHomeserverUrl.length > 0
        ? matrixHomeserverUrl
        : undefined,
    matrixHomeserverDomain:
      matrixHomeserverDomain && matrixHomeserverDomain.length > 0
        ? matrixHomeserverDomain
        : undefined,
    matrixProvisioningApiUrl:
      matrixProvisioningApiUrl && matrixProvisioningApiUrl.length > 0
        ? matrixProvisioningApiUrl
        : undefined,
    matrixProvisioningApiToken:
      matrixProvisioningApiToken && matrixProvisioningApiToken.length > 0
        ? matrixProvisioningApiToken
        : undefined,
    firebaseWebApiKey:
      firebaseWebApiKey && firebaseWebApiKey.length > 0 ? firebaseWebApiKey : undefined,
  };
}