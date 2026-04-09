import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {createAcceptFamilyInviteHandler} from './handler.ts';
import {readJsonObject} from '../_shared/http.ts';
import type {FamilyInviteRow} from './handler.ts';

function makeRepository(supabaseUrl: string, serviceKey: string) {
  const db = createClient(supabaseUrl, serviceKey);

  return {
    async findInviteByToken(token: string): Promise<FamilyInviteRow | null> {
      const {data, error} = await db
        .from('family_invites')
        .select('id, payer_matrix_user_id, invitee_matrix_user_id, status, expires_at')
        .eq('invite_token', token)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id as string,
        payerMatrixUserId: data.payer_matrix_user_id as string,
        inviteeMatrixUserId: data.invitee_matrix_user_id as string | null,
        status: data.status as 'pending' | 'accepted' | 'revoked',
        expiresAt: data.expires_at as string,
      };
    },

    async acceptInvite(
      inviteId: string,
      inviteeMatrixUserId: string,
      acceptedAt: string,
    ): Promise<void> {
      const {error} = await db
        .from('family_invites')
        .update({
          status: 'accepted',
          invitee_matrix_user_id: inviteeMatrixUserId,
          accepted_at: acceptedAt,
        })
        .eq('id', inviteId);
      if (error) throw new Error(error.message);
    },
  };
}

serve(async req => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const body = readJsonObject<unknown>(await req.text());
  const handler = createAcceptFamilyInviteHandler(makeRepository(supabaseUrl, serviceKey));

  const result = await handler(body);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {'Content-Type': 'application/json'},
  });
});
