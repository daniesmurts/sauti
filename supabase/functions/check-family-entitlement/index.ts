import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {createCheckFamilyEntitlementHandler} from './handler.ts';
import {readJsonObject} from '../_shared/http.ts';

function makeRepository(supabaseUrl: string, serviceKey: string) {
  const db = createClient(supabaseUrl, serviceKey);

  return {
    async hasActiveFamilySubscription(matrixUserId: string): Promise<boolean> {
      const {data, error} = await db
        .from('user_subscriptions')
        .select('plan, status')
        .eq('matrix_user_id', matrixUserId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return !!(data && data.plan === 'family' && data.status === 'active');
    },

    async hasAcceptedInvite(
      payerMatrixUserId: string,
      inviteeMatrixUserId: string,
    ): Promise<boolean> {
      const {data, error} = await db
        .from('family_invites')
        .select('id')
        .eq('payer_matrix_user_id', payerMatrixUserId)
        .eq('invitee_matrix_user_id', inviteeMatrixUserId)
        .eq('status', 'accepted')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },
  };
}

serve(async req => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const body = readJsonObject<unknown>(await req.text());
  const handler = createCheckFamilyEntitlementHandler(makeRepository(supabaseUrl, serviceKey));

  const result = await handler(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {'Content-Type': 'application/json'},
  });
});
