import {readSupabaseFunctionEnv} from './env.ts';

function buildUrl(path: string): string {
  const env = readSupabaseFunctionEnv();

  return `${env.supabaseUrl}${path}`;
}

function buildHeaders(extraHeaders: Record<string, string> = {}): HeadersInit {
  const env = readSupabaseFunctionEnv();

  return {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    ...extraHeaders,
  };
}

async function readTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function postgrestInsert(
  table: string,
  payload: Record<string, unknown>,
  options: {upsert?: boolean; onConflict?: string} = {},
): Promise<void> {
  const query = new URLSearchParams();
  if (options.onConflict) {
    query.set('on_conflict', options.onConflict);
  }

  const response = await fetch(
    buildUrl(`/rest/v1/${table}${query.toString() ? `?${query.toString()}` : ''}`),
    {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/json',
        Prefer: options.upsert
          ? 'resolution=merge-duplicates,return=minimal'
          : 'return=minimal',
      }),
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const body = await readTextSafe(response);
    throw new Error(`PostgREST insert failed (${response.status}): ${body}`);
  }
}

export async function postgrestUpdate(
  table: string,
  filters: Record<string, string>,
  payload: Record<string, unknown>,
): Promise<void> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    query.set(key, `eq.${value}`);
  });

  const response = await fetch(buildUrl(`/rest/v1/${table}?${query.toString()}`), {
    method: 'PATCH',
    headers: buildHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await readTextSafe(response);
    throw new Error(`PostgREST update failed (${response.status}): ${body}`);
  }
}

export async function postgrestSelectSingle<TValue>(
  table: string,
  filters: Record<string, string>,
  select: string,
): Promise<TValue | null> {
  const query = new URLSearchParams();
  query.set('select', select);
  query.set('limit', '1');

  Object.entries(filters).forEach(([key, value]) => {
    query.set(key, `eq.${value}`);
  });

  const response = await fetch(buildUrl(`/rest/v1/${table}?${query.toString()}`), {
    method: 'GET',
    headers: buildHeaders({
      Accept: 'application/json',
    }),
  });

  if (!response.ok) {
    const body = await readTextSafe(response);
    throw new Error(`PostgREST select failed (${response.status}): ${body}`);
  }

  const rows = (await response.json()) as TValue[];
  return rows[0] ?? null;
}