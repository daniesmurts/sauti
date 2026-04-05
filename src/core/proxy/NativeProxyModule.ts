import {NativeModules} from 'react-native';

export type NativeProxyStatus = 'connected' | 'connecting' | 'failed' | 'disabled';

export interface NativeProxyDiagnostics {
  status: NativeProxyStatus;
  isRunning: boolean;
  permissionRequired: boolean;
  lastError: string | null;
}

export interface NativeProxyModule {
  init(): Promise<boolean>;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  getStatus(): Promise<NativeProxyStatus>;
  getDiagnostics(): Promise<NativeProxyDiagnostics>;
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
    typeof module.getStatus !== 'function' ||
    typeof module.getDiagnostics !== 'function'
  ) {
    return null;
  }

  return module as NativeProxyModule;
}

export async function getNativeProxyDiagnostics(): Promise<NativeProxyDiagnostics | null> {
  const module = getNativeProxyModule();
  if (!module) {
    return null;
  }

  return module.getDiagnostics();
}