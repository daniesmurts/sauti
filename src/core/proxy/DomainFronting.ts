import {logger} from '../../utils/logger';
import {ProxyFetchFn, ProxyHttpsAgent, ProxyManager, ProxyStatus} from './ProxyManager';
import {initializeDomainFrontingPinning} from './SslPublicKeyPinning';

export interface DomainFrontingConfig {
  frontingHost: string;
  originHost: string;
  frontingPublicKeyHashes: string[];
}

type FetchHeaders = NonNullable<NonNullable<Parameters<typeof fetch>[1]>['headers']>;

function normalizeHeaders(headers?: FetchHeaders): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[String(key)] = String(value);
      return acc;
    }, {});
  }

  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export class DomainFrontingProxyManager implements ProxyManager {
  private enabled = true;
  private status: ProxyStatus = 'disabled';

  constructor(private readonly config: DomainFrontingConfig) {}

  async init(): Promise<void> {
    if (!this.enabled) {
      this.status = 'disabled';
      return;
    }

    this.status = 'connecting';
    try {
      await initializeDomainFrontingPinning({
        host: this.config.frontingHost,
        publicKeyHashes: this.config.frontingPublicKeyHashes,
      });
      this.status = 'connected';
    } catch (error) {
      logger.error('Domain fronting pinning initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.frontingHost,
      });
      this.status = 'failed';
    }
  }

  getStatus(): ProxyStatus {
    return this.status;
  }

  getHttpsAgent(): ProxyHttpsAgent | null {
    return null;
  }

  getFetchFn(): ProxyFetchFn {
    return async (input, init) => {
      const headers = normalizeHeaders(init?.headers);
      const inputUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      let requestUrl = inputUrl;
      let parsedUrl: URL | null = null;

      try {
        parsedUrl = new URL(inputUrl);
      } catch {
        parsedUrl = null;
      }

      if (parsedUrl) {
        if (parsedUrl.protocol !== 'https:') {
          throw new Error('Domain-fronted transport requires HTTPS.');
        }

        if (parsedUrl.hostname === this.config.originHost) {
          parsedUrl.hostname = this.config.frontingHost;
          requestUrl = parsedUrl.toString();
        }
      }

      // The Host header is part of the iOS MVP domain-fronting strategy in the spec.
      headers.Host = this.config.originHost;
      headers['X-Sauti-Fronting-Host'] = this.config.frontingHost;

      return fetch(requestUrl, {
        ...init,
        headers,
      });
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enable(): Promise<void> {
    this.enabled = true;
    this.status = 'connected';
  }

  async disable(): Promise<void> {
    this.enabled = false;
    this.status = 'disabled';
  }
}
