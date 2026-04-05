import {WatermelonDbWiper} from '../src/core/db';
import {
  createDefaultMatrixLogoutOrchestrator,
  matrixClient,
} from '../src/core/matrix';

describe('Matrix logout with DB wiper adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performs logout cleanup end-to-end with WatermelonDbWiper adapter', async () => {
    const db = {
      write: jest.fn(async <T>(action: () => Promise<T> | T) => await action()),
      unsafeResetDatabase: jest.fn(async () => undefined),
    };

    const sessionStore = {
      clearSession: jest.fn(async () => undefined),
    };

    const logoutSpy = jest
      .spyOn(matrixClient, 'logout')
      .mockResolvedValue(undefined);

    const dbWiper = new WatermelonDbWiper(db);
    const orchestrator = createDefaultMatrixLogoutOrchestrator(
      dbWiper,
      sessionStore as never,
    );

    const report = await orchestrator.execute();

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(sessionStore.clearSession).toHaveBeenCalledTimes(1);
    expect(db.write).toHaveBeenCalledTimes(1);
    expect(db.unsafeResetDatabase).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      revokedSession: true,
      clearedSecureSession: true,
      wipedLocalDb: true,
    });
  });
});
