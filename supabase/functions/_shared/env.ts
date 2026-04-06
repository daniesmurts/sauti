export interface SupabaseFunctionEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  otpTestCode?: string;
  matrixProvisioningApiUrl?: string;
  matrixProvisioningApiToken?: string;
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
  const matrixProvisioningApiUrl = Deno.env
    .get('MATRIX_PROVISIONING_API_URL')
    ?.trim();
  const matrixProvisioningApiToken = Deno.env
    .get('MATRIX_PROVISIONING_API_TOKEN')
    ?.trim();

  return {
    supabaseUrl: mustReadEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: mustReadEnv('SUPABASE_SERVICE_ROLE_KEY'),
    otpTestCode: otpTestCode && otpTestCode.length > 0 ? otpTestCode : undefined,
    matrixProvisioningApiUrl:
      matrixProvisioningApiUrl && matrixProvisioningApiUrl.length > 0
        ? matrixProvisioningApiUrl
        : undefined,
    matrixProvisioningApiToken:
      matrixProvisioningApiToken && matrixProvisioningApiToken.length > 0
        ? matrixProvisioningApiToken
        : undefined,
  };
}