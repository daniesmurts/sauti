import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {createFamilyInviteHandler} from './handler.ts';
import {readJsonObject} from '../_shared/http.ts';
import type {FamilyInviteRecord} from './handler.ts';

function makeRepository(supabaseUrl: string, serviceKey: string) {
  const db = createClient(supabaseUrl, serviceKey);

  return {
    async findSubscription(matrixUserId: string) {
      const {data, error} = await db
        .from('user_subscriptions')
        .select('plan, status')
        .eq('matrix_user_id', matrixUserId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as {plan: string; status: string} | null;
    },

    async countActiveInvites(payerMatrixUserId: string): Promise<number> {
      const {count, error} = await db
        .from('family_invites')
        .select('id', {count: 'exact', head: true})
        .eq('payer_matrix_user_id', payerMatrixUserId)
        .in('status', ['pending', 'accepted']);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async createInvite(payerMatrixUserId: string): Promise<FamilyInviteRecord> {
      const {data, error} = await db
        .from('family_invites')
        .insert({payer_matrix_user_id: payerMatrixUserId})
        .select('id, invite_token, invitee_matrix_user_id, status, created_at, expires_at')
        .single();
      if (error) throw new Error(error.message);
      return {
        id: data.id as string,
        inviteToken: data.invite_token as string,
        inviteeMatrixUserId: data.invitee_matrix_user_id as string | null,
        status: data.status as 'pending' | 'accepted' | 'revoked',
        createdAt: data.created_at as string,
        expiresAt: data.expires_at as string,
      };
    },
  };
}

serve(async req => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const body = readJsonObject<unknown>(await req.text());
  const handler = createFamilyInviteHandler(makeRepository(supabaseUrl, serviceKey));

  const result = await handler(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {'Content-Type': 'application/json'},
  });
});
