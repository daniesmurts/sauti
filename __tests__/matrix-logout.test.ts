import {
  MatrixLogoutOrchestrator,
  createDefaultMatrixLogoutOrchestrator,
} from '../src/core/matrix/MatrixLogout';

describe('MatrixLogoutOrchestrator', () => {
  it('revokes matrix session, clears secure session, and wipes local db', async () => {
    const callOrder: string[] = [];

    const orchestrator = new MatrixLogoutOrchestrator({
      logoutMatrixSession: jest.fn(async () => {
        callOrder.push('logout');
      }),
      clearSecureSession: jest.fn(async () => {
        callOrder.push('clearSession');
      }),
      wipeLocalDb: jest.fn(async () => {
        callOrder.push('wipeDb');
      }),
    });

    const report = await orchestrator.execute();

    expect(callOrder).toEqual(['logout', 'clearSession', 'wipeDb']);
    expect(report).toEqual({
      revokedSession: true,
      clearedSecureSession: true,
      wipedLocalDb: true,
    });
  });

  it('attempts remaining cleanup steps even if matrix logout fails', async () => {
    const clearSecureSession = jest.fn(async () => undefined);
    const wipeLocalDb = jest.fn(async () => undefined);

    const orchestrator = new MatrixLogoutOrchestrator({
      logoutMatrixSession: jest.fn(async () => {
        throw new Error('logout failed');
      }),
      clearSecureSession,
      wipeLocalDb,
    });

    await expect(orchestrator.execute()).rejects.toMatchObject({
      code: 'MATRIX_LOGOUT_CLEANUP_FAILED',
      name: 'SautiError',
    });

    expect(clearSecureSession).toHaveBeenCalledTimes(1);
    expect(wipeLocalDb).toHaveBeenCalledTimes(1);
  });

  it('builds default orchestrator wiring for matrix logout, session clear, and db wipe', async () => {
    const dbWiper = {
      wipeAllTables: jest.fn(async () => undefined),
    };
    const sessionStore = {
      clearSession: jest.fn(async () => undefined),
    };

    const orchestrator = createDefaultMatrixLogoutOrchestrator(
      dbWiper,
      sessionStore as never,
    );

    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.execute).toBe('function');
  });
});
