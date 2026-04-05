import {MatrixAuthSessionStore} from '../storage/MatrixAuthSessionStore';

import {matrixClient, SautiError} from './MatrixClient';

export interface MatrixDbWiper {
  wipeAllTables(): Promise<void>;
}

export interface MatrixLogoutDeps {
  logoutMatrixSession(): Promise<void>;
  clearSecureSession(): Promise<void>;
  wipeLocalDb(): Promise<void>;
}

export interface MatrixLogoutReport {
  revokedSession: boolean;
  clearedSecureSession: boolean;
  wipedLocalDb: boolean;
}

export class MatrixLogoutOrchestrator {
  constructor(private readonly deps: MatrixLogoutDeps) {}

  async execute(): Promise<MatrixLogoutReport> {
    const report: MatrixLogoutReport = {
      revokedSession: false,
      clearedSecureSession: false,
      wipedLocalDb: false,
    };

    const failures: Array<{step: string; error: unknown}> = [];

    try {
      await this.deps.logoutMatrixSession();
      report.revokedSession = true;
    } catch (error) {
      failures.push({step: 'logoutMatrixSession', error});
    }

    try {
      await this.deps.clearSecureSession();
      report.clearedSecureSession = true;
    } catch (error) {
      failures.push({step: 'clearSecureSession', error});
    }

    try {
      await this.deps.wipeLocalDb();
      report.wipedLocalDb = true;
    } catch (error) {
      failures.push({step: 'wipeLocalDb', error});
    }

    if (failures.length > 0) {
      throw new SautiError(
        'MATRIX_LOGOUT_CLEANUP_FAILED',
        'Matrix logout cleanup failed.',
        {
          failures,
          report,
        },
      );
    }

    return report;
  }
}

export function createDefaultMatrixLogoutOrchestrator(
  dbWiper: MatrixDbWiper,
  sessionStore = new MatrixAuthSessionStore(),
): MatrixLogoutOrchestrator {
  return new MatrixLogoutOrchestrator({
    logoutMatrixSession: () => matrixClient.logout(),
    clearSecureSession: () => sessionStore.clearSession(),
    wipeLocalDb: () => dbWiper.wipeAllTables(),
  });
}
