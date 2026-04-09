import {MatrixClient as MatrixSdkClient} from 'matrix-js-sdk';

import {matrixClient, SautiError} from './MatrixClient';

type MatrixClientProvider = () => MatrixSdkClient;

class MatrixCryptoWrapper {
  constructor(private readonly getClient: MatrixClientProvider = () => matrixClient.getClient()) {}

  async initializeE2EE(): Promise<void> {
    try {
      const client = this.getClient() as MatrixSdkClient & {
        initRustCrypto?: () => Promise<void>;
        initCrypto?: () => Promise<void>;
      };

      if (typeof client.initRustCrypto === 'function') {
        await client.initRustCrypto();
        return;
      }

      if (typeof client.initCrypto === 'function') {
        await client.initCrypto();
        return;
      }

      throw new Error('Matrix SDK missing both initRustCrypto and initCrypto APIs.');
    } catch (error) {
      throw new SautiError(
        'MATRIX_E2EE_INIT_FAILED',
        'Failed to initialize Matrix E2EE.',
        error,
      );
    }
  }

  async ensureKeyBackup(): Promise<void> {
    try {
      const client = this.getClient();
      const crypto = client.getCrypto();

      if (!crypto) {
        throw new Error('Matrix crypto not initialized.');
      }

      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true,
      });

      await crypto.bootstrapCrossSigning({
        setupNewCrossSigning: true,
      });

      await crypto.checkKeyBackupAndEnable();
    } catch (error) {
      throw new SautiError(
        'MATRIX_KEY_BACKUP_FAILED',
        'Failed to bootstrap Matrix key backup.',
        error,
      );
    }
  }

  async verifyDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const client = this.getClient();
      const crypto = client.getCrypto();

      if (!crypto) {
        throw new Error('Matrix crypto not initialized.');
      }

      const status = await crypto.getDeviceVerificationStatus(userId, deviceId);

      if (status?.crossSigningVerified) {
        return;
      }

      await crypto.setDeviceVerified(userId, deviceId, true);
    } catch (error) {
      throw new SautiError(
        'MATRIX_DEVICE_VERIFICATION_FAILED',
        'Failed to verify Matrix device.',
        error,
      );
    }
  }
}

export const matrixCrypto = new MatrixCryptoWrapper();
export {MatrixCryptoWrapper};
