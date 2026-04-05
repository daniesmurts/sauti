export type ProxyStatus =
  | 'connected'
  | 'connecting'
  | 'failed'
  | 'disabled';

// React Native runtime does not expose Node https.Agent directly.
// Keep this as unknown so platform implementations can adapt per native bridge.
export type ProxyHttpsAgent = unknown;
export type ProxyFetchFn = typeof fetch;

export interface ProxyManager {
  init(): Promise<void>;
  getStatus(): ProxyStatus;
  getHttpsAgent(): ProxyHttpsAgent | null;
  getFetchFn?(): ProxyFetchFn | undefined;
  isEnabled(): boolean;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export class NoopProxyManager implements ProxyManager {
  private enabled = false;

  async init(): Promise<void> {
    // No-op for early core bootstrap; platform-specific implementations will replace this.
  }

  getStatus(): ProxyStatus {
    return this.enabled ? 'connected' : 'disabled';
  }

  getHttpsAgent(): ProxyHttpsAgent | null {
    return null;
  }

  getFetchFn(): ProxyFetchFn | undefined {
    return undefined;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enable(): Promise<void> {
    this.enabled = true;
  }

  async disable(): Promise<void> {
    this.enabled = false;
  }
}

export const proxyManager: ProxyManager = new NoopProxyManager();
