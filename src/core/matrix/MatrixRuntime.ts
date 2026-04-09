import {MatrixClientInitOptions, SautiError} from './MatrixClient';
import {ProxyStatus} from '../proxy';

export interface MatrixRuntimeClient {
  connectToHomeserver(baseUrl: string): Promise<void>;
  initialize(options: MatrixClientInitOptions): unknown;
  reconnectAfterNetworkLoss(baseUrl: string): Promise<void>;
}

export interface MatrixRuntimeCrypto {
  initializeE2EE(): Promise<void>;
  ensureKeyBackup(): Promise<void>;
}

export interface MatrixRuntimeSync {
  start(): Promise<void>;
  stop(): void;
}

export interface MatrixRuntimeProxy {
  init(): Promise<void>;
  getFetchFn?(): typeof fetch | undefined;
  getStatus?(): ProxyStatus;
}

export interface MatrixRuntimeDeps {
  client: MatrixRuntimeClient;
  crypto: MatrixRuntimeCrypto;
  sync: MatrixRuntimeSync;
  proxy?: MatrixRuntimeProxy;
}

export interface MatrixRuntimeStartOptions extends MatrixClientInitOptions {
  enableE2EE?: boolean;
  enableKeyBackup?: boolean;
}

export class MatrixRuntime {
  private started = false;
  private baseUrl: string | null = null;

  constructor(private readonly deps: MatrixRuntimeDeps) {}

  isStarted(): boolean {
    return this.started;
  }

  getProxyStatus(): ProxyStatus {
    return this.deps.proxy?.getStatus?.() ?? 'disabled';
  }

  async start(options: MatrixRuntimeStartOptions): Promise<void> {
    try {
      let fetchFn: typeof fetch | undefined;

      if (this.deps.proxy) {
        await this.deps.proxy.init();
        fetchFn = this.deps.proxy.getFetchFn?.();
      }

      await this.deps.client.connectToHomeserver(options.baseUrl);
      this.deps.client.initialize({...options, fetchFn});

      if (options.enableE2EE !== false) {
        try {
          await this.deps.crypto.initializeE2EE();
        } catch {
          // E2EE bootstrap is best-effort because SDK crypto availability
          // differs across environments and native integrations.
        }
      }

      if (options.enableKeyBackup !== false) {
        try {
          await this.deps.crypto.ensureKeyBackup();
        } catch {
          // Key backup bootstrap is best-effort because some homeservers do not
          // support the full cross-signing flow required by matrix-js-sdk.
        }
      }

      await this.deps.sync.start();
      this.started = true;
      this.baseUrl = options.baseUrl;
    } catch (error) {
      throw new SautiError(
        'MATRIX_RUNTIME_START_FAILED',
        'Failed to start Matrix runtime.',
        error,
      );
    }
  }

  stop(): void {
    try {
      this.deps.sync.stop();
      this.started = false;
      this.baseUrl = null;
    } catch (error) {
      throw new SautiError(
        'MATRIX_RUNTIME_STOP_FAILED',
        'Failed to stop Matrix runtime.',
        error,
      );
    }
  }

  async recoverAfterNetworkLoss(): Promise<void> {
    if (!this.baseUrl) {
      throw new SautiError(
        'MATRIX_RUNTIME_RECOVERY_FAILED',
        'Cannot recover Matrix runtime before it has started.',
      );
    }

    try {
      await this.deps.client.reconnectAfterNetworkLoss(this.baseUrl);
    } catch (error) {
      throw new SautiError(
        'MATRIX_RUNTIME_RECOVERY_FAILED',
        'Matrix runtime recovery failed.',
        error,
      );
    }
  }
}
