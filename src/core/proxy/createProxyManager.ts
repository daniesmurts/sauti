import {readProxyEnv, readV2RayEnv, EnvSource} from '../config/env';
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
    // Read V2Ray config — null means tunnel cannot start (falls back to Noop via
    // ResilientProxyManager's allowDirectFallback).
    let v2rayConfig: ConstructorParameters<typeof AndroidVpnProxyManager>[0] = null;
    try {
      const env = readV2RayEnv(source);
      if (env) {
        v2rayConfig = {
          uuid: env.uuid,
          host: env.host,
          port: env.port,
          wsPath: env.wsPath,
        };
      }
    } catch {
      // Mis-configured env — fall through to NoopProxyManager
    }

    return new ResilientProxyManager(
      new AndroidVpnProxyManager(v2rayConfig),
      new NoopProxyManager(),
      {allowDirectFallback: true},
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
        frontingPublicKeyHashes: proxyEnv.frontingPublicKeyHashes,
      }),
      new NoopProxyManager(),
      {allowDirectFallback: true},
    );
  } catch (error) {
    if (error instanceof SautiError && error.code === 'MATRIX_CONFIG_INVALID') {
      return new NoopProxyManager();
    }

    throw error;
  }
}
