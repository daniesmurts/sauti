import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {createTbankWebhookHandler} from './handler.ts';
import {readJsonObject} from '../_shared/http.ts';
import {verifyTbankToken} from '../_shared/tbankToken.ts';

function makeRepository(supabaseUrl: string, serviceKey: string) {
  const db = createClient(supabaseUrl, serviceKey);
  return {
    async upsertSubscriptionByOrderId(orderId: string, status: 'active' | 'expired' | 'cancelled') {
      const {error} = await db
        .from('subscriptions')
        .upsert({order_id: orderId, status}, {onConflict: 'order_id'});
      if (error) throw new Error(error.message);
    },
  };
}

const tokenVerifier = {
  verify: (params: Record<string, unknown>, password: string) =>
    verifyTbankToken(params, password),
};

serve(async req => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const terminalPassword = Deno.env.get('TBANK_TERMINAL_PASSWORD') ?? '';

  const body = readJsonObject<unknown>(await req.text());
  const handler = createTbankWebhookHandler(
    makeRepository(supabaseUrl, serviceKey),
    tokenVerifier,
    terminalPassword,
  );

  const result = await handler(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {'Content-Type': 'application/json'},
  });
});
