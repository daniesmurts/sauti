import {readMatrixEnv} from '../config/env';

import {SautiError} from './MatrixClient';
import {createDefaultMatrixRuntime} from './createMatrixRuntime';
import {MatrixRuntime} from './MatrixRuntime';
import {MatrixSyncTokenStore} from './MatrixSync';

export interface MatrixAuthSession {
  userId: string;
  accessToken: string;
  deviceId?: string;
  refreshToken?: string;
}

export interface MatrixBootResult {
  runtime: MatrixRuntime;
  homeserverDomain: string;
}

export interface MatrixAuthSessionProvider {
  getRequiredValidSession(): Promise<MatrixAuthSession>;
}

export async function bootMatrixRuntime(
  tokenStore: MatrixSyncTokenStore,
  authSession: MatrixAuthSession,
): Promise<MatrixBootResult> {
  try {
    const env = readMatrixEnv();
    const runtime = createDefaultMatrixRuntime(tokenStore);

    await runtime.start({
      baseUrl: env.matrixHomeserverUrl,
      userId: authSession.userId,
      accessToken: authSession.accessToken,
      deviceId: authSession.deviceId,
    });

    return {
      runtime,
      homeserverDomain: env.matrixHomeserverDomain,
    };
  } catch (error) {
    if (error instanceof SautiError) {
      throw new SautiError(
        'MATRIX_BOOT_FAILED',
        'Matrix runtime boot failed.',
        error,
      );
    }

    throw new SautiError('MATRIX_BOOT_FAILED', 'Matrix runtime boot failed.', error);
  }
}

export async function bootMatrixRuntimeFromSessionStore(
  tokenStore: MatrixSyncTokenStore,
  sessionProvider: MatrixAuthSessionProvider,
): Promise<MatrixBootResult> {
  try {
    const authSession = await sessionProvider.getRequiredValidSession();
    return await bootMatrixRuntime(tokenStore, authSession);
  } catch (error) {
    if (error instanceof SautiError) {
      throw new SautiError(
        'MATRIX_BOOT_FAILED',
        'Matrix runtime boot failed.',
        error,
      );
    }

    throw new SautiError('MATRIX_BOOT_FAILED', 'Matrix runtime boot failed.', error);
  }
}
