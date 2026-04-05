import {NativeModules} from 'react-native';

export type NativeProxyStatus = 'connected' | 'connecting' | 'failed' | 'disabled';

export interface NativeProxyModule {
  init(): Promise<boolean>;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  getStatus(): Promise<NativeProxyStatus>;
}

export function getNativeProxyModule(): NativeProxyModule | null {
  const candidate = (NativeModules as Record<string, unknown>).SautiProxyModule;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const module = candidate as Partial<NativeProxyModule>;
  if (
    typeof module.init !== 'function' ||
    typeof module.enable !== 'function' ||
    typeof module.disable !== 'function' ||
    typeof module.isEnabled !== 'function' ||
    typeof module.getStatus !== 'function'
  ) {
    return null;
  }

  return module as NativeProxyModule;
}