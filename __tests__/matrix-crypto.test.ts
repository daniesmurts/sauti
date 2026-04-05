import {MatrixCryptoWrapper} from '../src/core/matrix/MatrixCrypto';

describe('MatrixCryptoWrapper', () => {
  it('initializes E2EE via matrix crypto API', async () => {
    const initCrypto = jest.fn().mockResolvedValue(undefined);
    const wrapper = new MatrixCryptoWrapper(() => ({initCrypto}) as never);

    await wrapper.initializeE2EE();

    expect(initCrypto).toHaveBeenCalledTimes(1);
  });

  it('bootstraps secret storage, cross-signing, and key backup', async () => {
    const bootstrapSecretStorage = jest.fn().mockResolvedValue(undefined);
    const bootstrapCrossSigning = jest.fn().mockResolvedValue(undefined);
    const checkKeyBackupAndEnable = jest.fn().mockResolvedValue(undefined);

    const wrapper = new MatrixCryptoWrapper(
      () =>
        ({
          bootstrapSecretStorage,
          bootstrapCrossSigning,
          checkKeyBackupAndEnable,
        }) as never,
    );

    await wrapper.ensureKeyBackup();

    expect(bootstrapSecretStorage).toHaveBeenCalledTimes(1);
    expect(bootstrapCrossSigning).toHaveBeenCalledTimes(1);
    expect(checkKeyBackupAndEnable).toHaveBeenCalledTimes(1);
  });

  it('verifies device when not already cross-signing verified', async () => {
    const setDeviceVerified = jest.fn().mockResolvedValue(undefined);
    const getDeviceVerificationStatus = jest
      .fn()
      .mockReturnValue({crossSigningVerified: false});

    const wrapper = new MatrixCryptoWrapper(
      () =>
        ({
          getDeviceVerificationStatus,
          setDeviceVerified,
        }) as never,
    );

    await wrapper.verifyDevice('@alice:example.org', 'DEVICE1');

    expect(getDeviceVerificationStatus).toHaveBeenCalledWith(
      '@alice:example.org',
      'DEVICE1',
    );
    expect(setDeviceVerified).toHaveBeenCalledWith(
      '@alice:example.org',
      'DEVICE1',
      true,
    );
  });

  it('throws typed error when E2EE init fails', async () => {
    const wrapper = new MatrixCryptoWrapper(
      () =>
        ({
          initCrypto: jest.fn().mockRejectedValue(new Error('init failed')),
        }) as never,
    );

    await expect(wrapper.initializeE2EE()).rejects.toMatchObject({
      code: 'MATRIX_E2EE_INIT_FAILED',
      name: 'SautiError',
    });
  });
});
