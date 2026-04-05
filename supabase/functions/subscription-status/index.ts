import {serve} from 'https://deno.land/std@0.224.0/http/server.ts';

import {readJsonObject} from '../_shared/http';
import {
  createSubscriptionStatusHandler,
  type SubscriptionStatusRepository,
} from './handler';

const repository: SubscriptionStatusRepository = {
  async findByMatrixUserId() {
    throw new Error('Supabase subscription repository integration not configured.');
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
