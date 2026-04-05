import {ProxyFetchFn, ProxyHttpsAgent, ProxyManager, ProxyStatus} from './ProxyManager';

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
