import {ProxyFetchFn, ProxyHttpsAgent, ProxyManager, ProxyStatus} from './ProxyManager';

export interface ResilientProxyOptions {
  allowDirectFallback: boolean;
}

export class ResilientProxyManager implements ProxyManager {
  private status: ProxyStatus = 'disabled';

  constructor(
    private readonly primary: ProxyManager,
    private readonly fallback: ProxyManager,
    private readonly options: ResilientProxyOptions,
  ) {}

  async init(): Promise<void> {
    this.status = 'connecting';

    try {
      await this.primary.init();
      this.status = this.primary.getStatus();
      return;
    } catch {
      this.status = 'failed';

      if (!this.options.allowDirectFallback) {
        throw new Error('Primary proxy init failed and direct fallback is disabled.');
      }

      await this.fallback.init();
      this.status = this.fallback.getStatus();
    }
  }

  getStatus(): ProxyStatus {
    return this.status;
  }

  getHttpsAgent(): ProxyHttpsAgent | null {
    const agent = this.primary.getHttpsAgent();
    if (agent) {
      return agent;
    }

    return this.fallback.getHttpsAgent();
  }

  getFetchFn(): ProxyFetchFn | undefined {
    return this.primary.getFetchFn?.() ?? this.fallback.getFetchFn?.();
  }

  isEnabled(): boolean {
    return this.status === 'connected' || this.status === 'connecting';
  }

  async enable(): Promise<void> {
    await this.primary.enable();
    this.status = this.primary.getStatus();
  }

  async disable(): Promise<void> {
    await this.primary.disable();
    await this.fallback.disable();
    this.status = 'disabled';
  }
}
