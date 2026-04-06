import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readJsonObject} from '../_shared/http.ts';
import {postgrestSelectSingle} from '../_shared/postgrest.ts';
import {
  createSubscriptionStatusHandler,
  type SubscriptionStatusRepository,
} from './handler.ts';

const repository: SubscriptionStatusRepository = {
  async findByMatrixUserId(matrixUserId) {
    const row = await postgrestSelectSingle<{
      matrix_user_id: string;
      plan: 'free' | 'family';
      status: 'active' | 'expired' | 'cancelled';
      current_period_end?: string | null;
    }>('user_subscriptions', {matrix_user_id: matrixUserId}, 'matrix_user_id,plan,status,current_period_end');

    if (!row) {
      return null;
    }

    return {
      matrixUserId: row.matrix_user_id,
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end ?? undefined,
    };
  },
};

const handler = createSubscriptionStatusHandler(repository);

serve(async request => {
  const body = readJsonObject(await request.text());
  const result = await handler(body);

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
});
