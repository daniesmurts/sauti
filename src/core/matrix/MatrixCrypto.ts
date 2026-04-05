import {MatrixClient as MatrixSdkClient} from 'matrix-js-sdk';

import {matrixClient, SautiError} from './MatrixClient';

interface MatrixCryptoApi {
  initCrypto?: () => Promise<void>;
  bootstrapSecretStorage?: (opts: {
    setupNewSecretStorage?: boolean;
    createSecretStorageKey?: () => Promise<{keyInfo: Record<string, unknown>; privateKey: Uint8Array}>;
  }) => Promise<void>;
  bootstrapCrossSigning?: (opts: {
    setupNewCrossSigning?: boolean;
    authUploadDeviceSigningKeys?: (makeRequest: unknown) => Promise<void>;
  }) => Promise<void>;
  checkKeyBackupAndEnable?: () => Promise<void>;
  getDeviceVerificationStatus?: (
    userId: string,
    deviceId: string,
  ) => {crossSigningVerified?: boolean} | null;
  setDeviceVerified?: (
    userId: string,
    deviceId: string,
    verified?: boolean,
  ) => Promise<void>;
}

type MatrixClientProvider = () => MatrixSdkClient;

class MatrixCryptoWrapper {
  constructor(private readonly getClient: MatrixClientProvider = () => matrixClient.getClient()) {}

  private getCryptoApi(): MatrixCryptoApi {
    return this.getClient() as MatrixSdkClient & MatrixCryptoApi;
  }

  async initializeE2EE(): Promise<void> {
    try {
      const client = this.getCryptoApi();
      if (!client.initCrypto) {
        throw new Error('Matrix SDK missing initCrypto API.');
      }

      await client.initCrypto();
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
      const client = this.getCryptoApi();

      if (!client.bootstrapSecretStorage) {
        throw new Error('Matrix SDK missing bootstrapSecretStorage API.');
      }

      if (!client.bootstrapCrossSigning) {
        throw new Error('Matrix SDK missing bootstrapCrossSigning API.');
      }

      await client.bootstrapSecretStorage({
        setupNewSecretStorage: true,
      });

      await client.bootstrapCrossSigning({
        setupNewCrossSigning: true,
      });

      if (client.checkKeyBackupAndEnable) {
        await client.checkKeyBackupAndEnable();
      }
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
      const client = this.getCryptoApi();
      const status = client.getDeviceVerificationStatus
        ? client.getDeviceVerificationStatus(userId, deviceId)
        : null;

      if (status?.crossSigningVerified) {
        return;
      }

      if (!client.setDeviceVerified) {
        throw new Error('Matrix SDK missing setDeviceVerified API.');
      }

      await client.setDeviceVerified(userId, deviceId, true);
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
