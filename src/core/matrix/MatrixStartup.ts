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

export async function startMatrixFromStoredSession(
  tokenStore: MatrixSyncTokenStore,
  sessionProvider: MatrixAuthSessionProvider,
): Promise<MatrixStartupResult> {
  try {
    const boot = await bootMatrixRuntimeFromSessionStore(tokenStore, sessionProvider);
    return {status: 'ready', boot};
  } catch (error) {
    if (error instanceof SautiError) {
      const cause = error.cause;
      if (
        cause instanceof SautiError &&
        cause.code === 'MATRIX_SESSION_MISSING'
      ) {
        return {status: 'signed_out', reason: 'session_missing'};
      }

      if (
        cause instanceof SautiError &&
        cause.code === 'MATRIX_SESSION_EXPIRED'
      ) {
        return {status: 'signed_out', reason: 'session_expired'};
      }

      if (
        cause instanceof SautiError &&
        cause.code === 'MATRIX_SESSION_INVALID'
      ) {
        return {status: 'signed_out', reason: 'session_invalid'};
      }

      throw new SautiError(
        'MATRIX_STARTUP_FAILED',
        'Matrix startup from stored session failed.',
        error,
      );
    }

    throw new SautiError(
      'MATRIX_STARTUP_FAILED',
      'Matrix startup from stored session failed.',
      error,
    );
  }
}
