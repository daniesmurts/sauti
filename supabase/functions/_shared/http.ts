export interface EdgeResponse<TBody> {
  status: number;
  body: TBody;
}

export function jsonResponse<TBody>(status: number, body: TBody): EdgeResponse<TBody> {
  return {status, body};
}

export function readJsonObject<TValue>(raw: string): TValue | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as TValue;
  } catch {
    return null;
  }
}
