import {readProxyEnv, EnvSource} from '../config/env';
import {SautiError} from '../matrix/MatrixClient';
import {Platform} from 'react-native';

import {DomainFrontingProxyManager} from './DomainFronting';
import {NoopProxyManager, ProxyManager} from './ProxyManager';
import {AndroidVpnProxyManager} from './PlatformProxyManagers';
import {ResilientProxyManager} from './ResilientProxyManager';

export function createDefaultProxyManager(
  source?: EnvSource,
): ProxyManager {
  if (Platform.OS === 'android') {
    return new ResilientProxyManager(
      new AndroidVpnProxyManager(),
      new NoopProxyManager(),
      {
        allowDirectFallback: true,
      },
    );
  }

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
