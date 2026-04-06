import {ProxyFetchFn, ProxyHttpsAgent, ProxyManager, ProxyStatus} from './ProxyManager';
import {NativeProxyStatus, getNativeProxyModule} from './NativeProxyModule';

export interface PlatformProxyBridge {
  init(): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): boolean;
  getFetchFn?(): ProxyFetchFn | undefined;
}

class BasePlatformProxyManager implements ProxyManager {
  protected status: ProxyStatus = 'disabled';

  constructor(protected readonly bridge: PlatformProxyBridge) {}

  async init(): Promise<void> {
    this.status = 'connecting';
    await this.bridge.init();
    this.status = this.bridge.isEnabled() ? 'connected' : 'disabled';
  }

  getStatus(): ProxyStatus {
    return this.status;
  }

  getHttpsAgent(): ProxyHttpsAgent | null {
    return null;
  }

  getFetchFn(): ProxyFetchFn | undefined {
    return this.bridge.getFetchFn?.();
  }

  isEnabled(): boolean {
    return this.bridge.isEnabled();
  }

  async enable(): Promise<void> {
    await this.bridge.enable();
    this.status = 'connected';
  }

  async disable(): Promise<void> {
    await this.bridge.disable();
    this.status = 'disabled';
  }
}

export class AndroidProxyManager extends BasePlatformProxyManager {}

export class IOSProxyManager extends BasePlatformProxyManager {}

function toProxyStatus(status: NativeProxyStatus): ProxyStatus {
  switch (status) {
    case 'connected':
    case 'connecting':
    case 'failed':
    case 'disabled':
      return status;
    default:
      return 'failed';
  }
}

export class AndroidVpnProxyManager implements ProxyManager {
  private status: ProxyStatus = 'disabled';

  async init(): Promise<void> {
    const module = getNativeProxyModule();
    if (!module) {
      throw new Error('SautiProxyModule is unavailable.');
    }

    await module.init();
    this.syncStatus(await module.getStatus());
  }

  getStatus(): ProxyStatus {
    return this.status;
  }

  getHttpsAgent(): ProxyHttpsAgent | null {
    return null;
  }

  getFetchFn(): ProxyFetchFn | undefined {
    return undefined;
  }

  isEnabled(): boolean {
    return this.status === 'connected' || this.status === 'connecting';
  }

  async enable(): Promise<void> {
    const module = getNativeProxyModule();
    if (!module) {
      throw new Error('SautiProxyModule is unavailable.');
    }

    try {
      await module.enable();
    } catch (error: unknown) {
      const code = (error as {code?: string}).code;
      if (code === 'PROXY_PERMISSION_REQUIRED') {
        await module.requestVpnPermission();
        await module.enable();
      } else {
        throw error;
      }
    }

    this.syncStatus(await module.getStatus());
  }

  async disable(): Promise<void> {
    const module = getNativeProxyModule();
    if (!module) {
      this.status = 'disabled';
      return;
    }

    await module.disable();
    this.syncStatus(await module.getStatus());
  }

  private syncStatus(status: NativeProxyStatus): void {
    this.status = toProxyStatus(status);
  }
}
