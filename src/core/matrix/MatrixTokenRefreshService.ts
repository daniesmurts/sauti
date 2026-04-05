import {readMatrixEnv} from '../config/env';
import {MatrixAuthSessionStore} from '../storage/MatrixAuthSessionStore';

import {matrixClient, SautiError} from './MatrixClient';

export interface MatrixTokenRefresher {
  refreshNow(): Promise<void>;
}

export class MatrixTokenRefreshService implements MatrixTokenRefresher {
  constructor(
    private readonly sessionStore: MatrixAuthSessionStore,
    private readonly refreshSessionTtlMs = 24 * 60 * 60 * 1000,
  ) {}

  async refreshNow(): Promise<void> {
    try {
      const session = await this.sessionStore.loadSession();
      if (!session?.refreshToken) {
        return;
      }

      const env = readMatrixEnv();
      const accessToken = await matrixClient.refreshAccessToken(
        env.matrixHomeserverUrl,
        session.refreshToken,
      );

      await this.sessionStore.saveSession(
        {
          ...session,
          accessToken,
        },
        this.refreshSessionTtlMs,
      );
    } catch (error) {
      throw new SautiError(
        'MATRIX_TOKEN_REFRESH_LIFECYCLE_FAILED',
        'Matrix token refresh lifecycle step failed.',
        error,
      );
    }
  }
}
