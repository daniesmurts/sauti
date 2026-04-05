import {readProxyEnv, EnvSource} from '../config/env';
import {SautiError} from '../matrix/MatrixClient';

import {DomainFrontingProxyManager} from './DomainFronting';
import {NoopProxyManager, ProxyManager} from './ProxyManager';
import {ResilientProxyManager} from './ResilientProxyManager';

export function createDefaultProxyManager(
  source?: EnvSource,
): ProxyManager {
  try {
    const proxyEnv = readProxyEnv(source);

    if (!proxyEnv) {
      return new NoopProxyManager();
    }

    return new ResilientProxyManager(
      new DomainFrontingProxyManager({
        frontingHost: proxyEnv.frontingHost,
        originHost: proxyEnv.originHost,
      }),
      new NoopProxyManager(),
      {
        allowDirectFallback: true,
      },
    );
  } catch (error) {
    if (error instanceof SautiError && error.code === 'MATRIX_CONFIG_INVALID') {
      return new NoopProxyManager();
    }

    throw error;
  }
}
