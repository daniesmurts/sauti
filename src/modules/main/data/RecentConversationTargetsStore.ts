const RECENT_TARGETS_KEY = 'main.recent.targets.v1';
const MAX_RECENT_TARGETS = 8;

interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export interface RecentConversationTargetsStore {
  listTargets(): Promise<string[]>;
  addTarget(target: string): Promise<void>;
  removeTarget(target: string): Promise<void>;
  clearTargets(): Promise<void>;
}

function normalizeTarget(target: string): string {
  return target.trim();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

class SecureStoreRecentConversationTargetsStore
  implements RecentConversationTargetsStore
{
  constructor(private readonly secureStore: SecureStoreApi) {}

  async listTargets(): Promise<string[]> {
    const raw = await this.secureStore.getItemAsync(RECENT_TARGETS_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStringArray(parsed)) {
        return [];
      }

      return parsed.slice(0, MAX_RECENT_TARGETS);
    } catch {
      return [];
    }
  }

  async addTarget(target: string): Promise<void> {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return;
    }

    const existing = await this.listTargets();
    const deduped = [
      normalized,
      ...existing.filter(item => item !== normalized),
    ].slice(0, MAX_RECENT_TARGETS);

    await this.secureStore.setItemAsync(
      RECENT_TARGETS_KEY,
      JSON.stringify(deduped),
    );
  }

  async removeTarget(target: string): Promise<void> {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return;
    }

    const existing = await this.listTargets();
    const filtered = existing.filter(item => item !== normalized);

    await this.secureStore.setItemAsync(
      RECENT_TARGETS_KEY,
      JSON.stringify(filtered),
    );
  }

  async clearTargets(): Promise<void> {
    await this.secureStore.setItemAsync(RECENT_TARGETS_KEY, JSON.stringify([]));
  }
}

class InMemoryRecentConversationTargetsStore
  implements RecentConversationTargetsStore
{
  private targets: string[] = [];

  async listTargets(): Promise<string[]> {
    return this.targets;
  }

  async addTarget(target: string): Promise<void> {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return;
    }

    this.targets = [
      normalized,
      ...this.targets.filter(item => item !== normalized),
    ].slice(0, MAX_RECENT_TARGETS);
  }

  async removeTarget(target: string): Promise<void> {
    const normalized = normalizeTarget(target);
    if (!normalized) {
      return;
    }

    this.targets = this.targets.filter(item => item !== normalized);
  }

  async clearTargets(): Promise<void> {
    this.targets = [];
  }
}

export function createRuntimeRecentConversationTargetsStore(): RecentConversationTargetsStore {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const secureStore = require('expo-secure-store') as SecureStoreApi;
    return new SecureStoreRecentConversationTargetsStore(secureStore);
  } catch {
    // Fallback keeps tests and non-native environments functional.
    return new InMemoryRecentConversationTargetsStore();
  }
}

export function createInMemoryRecentConversationTargetsStore(): RecentConversationTargetsStore {
  return new InMemoryRecentConversationTargetsStore();
}
