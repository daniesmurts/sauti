import {SautiError} from '../matrix/MatrixClient';
import {MatrixDbWiper} from '../matrix/MatrixLogout';

interface ResettableWatermelonDb {
  write<T>(action: () => Promise<T> | T): Promise<T>;
  unsafeResetDatabase(): Promise<void>;
}

export class WatermelonDbWiper implements MatrixDbWiper {
  constructor(private readonly db: ResettableWatermelonDb) {}

  async wipeAllTables(): Promise<void> {
    try {
      await this.db.write(async () => {
        await this.db.unsafeResetDatabase();
      });
    } catch (error) {
      throw new SautiError(
        'MATRIX_LOGOUT_CLEANUP_FAILED',
        'Failed to wipe local database during Matrix logout cleanup.',
        error,
      );
    }
  }
}
