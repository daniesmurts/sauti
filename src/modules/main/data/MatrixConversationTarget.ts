export type MatrixConversationTargetKind =
  | 'user_id'
  | 'room_alias'
  | 'room_id';

export interface ParsedMatrixConversationTarget {
  raw: string;
  normalized: string;
  kind: MatrixConversationTargetKind;
}

export interface MatrixConversationTargetValidation {
  ok: true;
  target: ParsedMatrixConversationTarget;
}

export interface MatrixConversationTargetValidationError {
  ok: false;
  error: string;
}

export type MatrixConversationTargetValidationResult =
  | MatrixConversationTargetValidation
  | MatrixConversationTargetValidationError;

const MATRIX_LOCALPART = '[A-Za-z0-9._=\\/-]+';
const MATRIX_DOMAIN = '[A-Za-z0-9.-]+(?::[0-9]{1,5})?';

const USER_ID_RE = new RegExp(`^@${MATRIX_LOCALPART}:${MATRIX_DOMAIN}$`);
const ROOM_ALIAS_RE = new RegExp(`^#${MATRIX_LOCALPART}:${MATRIX_DOMAIN}$`);
const ROOM_ID_RE = new RegExp(`^!${MATRIX_LOCALPART}:${MATRIX_DOMAIN}$`);

function normalize(input: string): string {
  return input.trim();
}

export function parseMatrixConversationTarget(
  input: string,
): MatrixConversationTargetValidationResult {
  const normalized = normalize(input);

  if (!normalized) {
    return {
      ok: false,
      error: 'Enter a Matrix user ID or room alias.',
    };
  }

  if (USER_ID_RE.test(normalized)) {
    return {
      ok: true,
      target: {
        raw: input,
        normalized,
        kind: 'user_id',
      },
    };
  }

  if (ROOM_ALIAS_RE.test(normalized)) {
    return {
      ok: true,
      target: {
        raw: input,
        normalized,
        kind: 'room_alias',
      },
    };
  }

  if (ROOM_ID_RE.test(normalized)) {
    return {
      ok: true,
      target: {
        raw: input,
        normalized,
        kind: 'room_id',
      },
    };
  }

  return {
    ok: false,
    error:
      'Use @user:server, #room:server, or !room:server format.',
  };
}
