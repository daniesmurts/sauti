type SslPinningModule = {
  isSslPinningAvailable?: () => boolean;
  initializeSslPinning?: (options: Record<string, unknown>) => Promise<void>;
};

function getSslPinningModule(): SslPinningModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-ssl-public-key-pinning') as SslPinningModule;
  } catch {
    return null;
  }
}

const sslPinningModule = getSslPinningModule();

export async function initializeDomainFrontingPinning(options: {
  host: string;
  publicKeyHashes: string[];
}): Promise<void> {
  if (!sslPinningModule || typeof sslPinningModule.initializeSslPinning !== 'function') {
    throw new Error('SSL pinning module is unavailable.');
  }

  if (
    typeof sslPinningModule.isSslPinningAvailable === 'function' &&
    !sslPinningModule.isSslPinningAvailable()
  ) {
    throw new Error('SSL pinning is not available on this runtime.');
  }

  await sslPinningModule.initializeSslPinning({
    [options.host]: {
      includeSubdomains: true,
      publicKeyHashes: options.publicKeyHashes,
    },
  });
}