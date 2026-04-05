import {matrixClient, SautiError} from './MatrixClient';
import {matrixCrypto} from './MatrixCrypto';
import {MatrixRuntime} from './MatrixRuntime';
import {MatrixSync, MatrixSyncTokenStore} from './MatrixSync';
import {createDefaultProxyManager, ProxyManager} from '../proxy';

interface MatrixSdkSyncLifecycle {
  startClient?: (options?: Record<string, unknown>) => void;
  stopClient?: () => void;
}

function getSyncLifecycleClient(): MatrixSdkSyncLifecycle {
  return matrixClient.getClient() as MatrixSdkSyncLifecycle;
}

export function createDefaultMatrixRuntime(
  tokenStore: MatrixSyncTokenStore,
  options: {proxyManager?: ProxyManager} = {},
): MatrixRuntime {
  const resolvedProxyManager =
    options.proxyManager ?? createDefaultProxyManager();

  const sync = new MatrixSync(
    {
      startClient: (options?: Record<string, unknown>) => {
        const client = getSyncLifecycleClient();
        if (!client.startClient) {
          throw new SautiError(
            'MATRIX_RUNTIME_START_FAILED',
            'Matrix SDK client does not expose startClient.',
          );
        }

        client.startClient(options);
      },
      stopClient: () => {
        const client = getSyncLifecycleClient();
        if (!client.stopClient) {
          throw new SautiError(
            'MATRIX_RUNTIME_STOP_FAILED',
            'Matrix SDK client does not expose stopClient.',
          );
        }

        client.stopClient();
      },
    },
    tokenStore,
    {
      tokenSource: {
        subscribe: listener => matrixClient.subscribeSyncToken(listener),
      },
    },
  );

  return new MatrixRuntime({
    client: matrixClient,
    crypto: matrixCrypto,
    sync,
    proxy: resolvedProxyManager,
  });
}
