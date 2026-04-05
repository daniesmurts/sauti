import {EnsureCoreRuntimeOptions} from '../bootstrap';

import {bootAppRuntime, getAppStartupSnapshot} from './AppStartupRuntime';

export type TerminalAppStartupStatus = 'ready' | 'signed_out' | 'error';

export interface TerminalAppStartupSnapshot {
  status: TerminalAppStartupStatus;
  reason?: 'session_missing' | 'session_expired' | 'session_invalid';
  errorMessage?: string;
}

function isTerminalStatus(
  status: string,
): status is TerminalAppStartupStatus {
  return status === 'ready' || status === 'signed_out' || status === 'error';
}

export async function launchAppRuntime(
  options?: EnsureCoreRuntimeOptions,
): Promise<TerminalAppStartupSnapshot> {
  try {
    await bootAppRuntime(options);
    const snapshot = getAppStartupSnapshot();

    if (isTerminalStatus(snapshot.status)) {
      return {
        status: snapshot.status,
        reason: snapshot.reason,
        errorMessage: snapshot.errorMessage,
      };
    }

    return {
      status: 'error',
      errorMessage: `Startup resolved with non-terminal status: ${snapshot.status}`,
    };
  } catch (error) {
    const snapshot = getAppStartupSnapshot();

    if (snapshot.status === 'error') {
      return {
        status: 'error',
        errorMessage: snapshot.errorMessage,
      };
    }

    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown startup error',
    };
  }
}
