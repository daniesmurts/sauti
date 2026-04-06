import {
  bootMatrixRuntimeFromSessionStore,
  MatrixAuthSessionProvider,
  MatrixBootResult,
} from './MatrixBoot';
import {SautiError} from './MatrixClient';
import {MatrixSyncTokenStore} from './MatrixSync';

export type MatrixStartupResult =
  | {
      status: 'ready';
      boot: MatrixBootResult;
    }
  | {
      status: 'signed_out';
      reason: 'session_missing' | 'session_expired' | 'session_invalid';
    };

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {code?: unknown};
  return typeof candidate.code === 'string' ? candidate.code : null;
}

function getErrorCause(error: unknown): unknown {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return (error as {cause?: unknown}).cause;
}

export async function startMatrixFromStoredSession(
  tokenStore: MatrixSyncTokenStore,
  sessionProvider: MatrixAuthSessionProvider,
): Promise<MatrixStartupResult> {
  try {
    const boot = await bootMatrixRuntimeFromSessionStore(tokenStore, sessionProvider);
    return {status: 'ready', boot};
  } catch (error) {
    const errorCode = getErrorCode(error);
    const causeCode = getErrorCode(getErrorCause(error));

    if (errorCode === 'MATRIX_SESSION_MISSING' || causeCode === 'MATRIX_SESSION_MISSING') {
      return {status: 'signed_out', reason: 'session_missing'};
    }

    if (errorCode === 'MATRIX_SESSION_EXPIRED' || causeCode === 'MATRIX_SESSION_EXPIRED') {
      return {status: 'signed_out', reason: 'session_expired'};
    }

    if (errorCode === 'MATRIX_SESSION_INVALID' || causeCode === 'MATRIX_SESSION_INVALID') {
      return {status: 'signed_out', reason: 'session_invalid'};
    }

    throw new SautiError(
      'MATRIX_STARTUP_FAILED',
      'Matrix startup from stored session failed.',
      error,
    );
  }
}
