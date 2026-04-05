import {WatermelonDbWiper} from '../src/core/db';

describe('WatermelonDbWiper', () => {
  it('resets local database inside a write transaction', async () => {
    const callOrder: string[] = [];

    const db = {
      write: jest.fn(async <T>(action: () => Promise<T> | T) => {
        callOrder.push('write');
        return await action();
      }),
      unsafeResetDatabase: jest.fn(async () => {
        callOrder.push('unsafeResetDatabase');
      }),
    };

    const wiper = new WatermelonDbWiper(db);
    await wiper.wipeAllTables();

    expect(db.write).toHaveBeenCalledTimes(1);
    expect(db.unsafeResetDatabase).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['write', 'unsafeResetDatabase']);
  });

  it('throws typed error when reset fails', async () => {
    const db = {
      write: jest.fn(async <T>(action: () => Promise<T> | T) => await action()),
      unsafeResetDatabase: jest.fn(async () => {
        throw new Error('reset failed');
      }),
    };

    const wiper = new WatermelonDbWiper(db);

    await expect(wiper.wipeAllTables()).rejects.toMatchObject({
      code: 'MATRIX_LOGOUT_CLEANUP_FAILED',
      name: 'SautiError',
    });
  });
});
