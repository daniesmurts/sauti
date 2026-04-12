import {Q} from '@nozbe/watermelondb';

export type ContactSource = 'conversation_sync' | 'directory_import' | 'manual';

export interface ContactDirectoryRecord {
  contactId: string;
  displayName: string;
  matrixUserId?: string;
  phoneNumber?: string;
  source: ContactSource;
  lastMessage?: string;
  isOnline: boolean;
  updatedAt: number;
}

export interface ContactDirectoryStore {
  upsertContact(input: {
    contactId: string;
    displayName: string;
    matrixUserId?: string;
    phoneNumber?: string;
    source: ContactSource;
    lastMessage?: string;
    isOnline?: boolean;
    updatedAt: number;
  }): Promise<void>;
  listContacts(): Promise<ContactDirectoryRecord[]>;
}

interface WatermelonContactModel {
  _raw: {
    id?: string;
    display_name?: string;
    matrix_user_id?: string;
    phone_number?: string;
    source?: string;
    last_message?: string;
    is_online?: boolean;
    updated_at?: number;
  };
  update(updater: () => void): Promise<void>;
}

const CONTACT_SOURCE_PRIORITY: Record<ContactSource, number> = {
  conversation_sync: 1,
  directory_import: 2,
  manual: 3,
};

function normalizeOptionalString(value?: string): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

function isLikelyMatrixUserId(value: string): boolean {
  return /^@[^\s:]+:[^\s:]+$/.test(value);
}

function isLikelyPhoneNumber(value: string): boolean {
  return /^\+?[0-9][0-9]{6,14}$/.test(normalizePhoneNumber(value));
}

function parseStoredSource(value?: string): ContactSource {
  if (value === 'manual' || value === 'directory_import' || value === 'conversation_sync') {
    return value;
  }

  return 'conversation_sync';
}

export function inferContactIdentityMetadata(input: {
  displayName: string;
  matrixUserId?: string;
  phoneNumber?: string;
}): {
  displayName: string;
  matrixUserId?: string;
  phoneNumber?: string;
} {
  const displayName = normalizeOptionalString(input.displayName) ?? 'Unknown';
  const explicitMatrixUserId = normalizeOptionalString(input.matrixUserId);
  const explicitPhoneNumber = normalizeOptionalString(input.phoneNumber);

  return {
    displayName,
    matrixUserId:
      explicitMatrixUserId ??
      (isLikelyMatrixUserId(displayName) ? displayName : undefined),
    phoneNumber:
      explicitPhoneNumber ??
      (isLikelyPhoneNumber(displayName) ? normalizePhoneNumber(displayName) : undefined),
  };
}

export function mergeContactRecord(
  existing: ContactDirectoryRecord | null,
  incoming: {
    contactId: string;
    displayName: string;
    matrixUserId?: string;
    phoneNumber?: string;
    source: ContactSource;
    lastMessage?: string;
    isOnline?: boolean;
    updatedAt: number;
  },
): ContactDirectoryRecord {
  const inferred = inferContactIdentityMetadata(incoming);
  const existingPriority = existing ? CONTACT_SOURCE_PRIORITY[existing.source] : 0;
  const incomingPriority = CONTACT_SOURCE_PRIORITY[incoming.source];
  const prefersIncomingIdentity = incomingPriority >= existingPriority;

  return {
    contactId: incoming.contactId,
    displayName:
      prefersIncomingIdentity || !existing?.displayName
        ? inferred.displayName
        : existing.displayName,
    matrixUserId: inferred.matrixUserId ?? existing?.matrixUserId,
    phoneNumber: inferred.phoneNumber ?? existing?.phoneNumber,
    source: prefersIncomingIdentity ? incoming.source : existing?.source ?? incoming.source,
    lastMessage: normalizeOptionalString(incoming.lastMessage) ?? existing?.lastMessage,
    isOnline:
      typeof incoming.isOnline === 'boolean'
        ? incoming.isOnline
        : existing?.isOnline ?? false,
    updatedAt: Math.max(existing?.updatedAt ?? 0, incoming.updatedAt),
  };
}

interface WatermelonContactsCollectionLike {
  database: {
    write<T>(action: () => Promise<T> | T): Promise<T>;
  };
  create(builder: (record: WatermelonContactModel) => void): Promise<void>;
  query(...conditions: unknown[]): {
    fetch(): Promise<WatermelonContactModel[]>;
  };
}

interface WatermelonDatabaseLike {
  get(table: 'contacts'): WatermelonContactsCollectionLike;
}

function toContactRecord(model: WatermelonContactModel): ContactDirectoryRecord | null {
  const contactId = model._raw.id;
  const displayName = model._raw.display_name;
  const updatedAt = model._raw.updated_at;

  if (
    typeof contactId !== 'string' ||
    contactId.length === 0 ||
    typeof displayName !== 'string' ||
    displayName.length === 0 ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }

  return {
    contactId,
    displayName,
    matrixUserId: normalizeOptionalString(model._raw.matrix_user_id),
    phoneNumber: normalizeOptionalString(model._raw.phone_number),
    source: parseStoredSource(model._raw.source),
    lastMessage: model._raw.last_message,
    isOnline: model._raw.is_online === true,
    updatedAt,
  };
}

export class WatermelonContactDirectoryStore implements ContactDirectoryStore {
  constructor(private readonly contacts: WatermelonContactsCollectionLike) {}

  async upsertContact(input: {
    contactId: string;
    displayName: string;
    matrixUserId?: string;
    phoneNumber?: string;
    source: ContactSource;
    lastMessage?: string;
    isOnline?: boolean;
    updatedAt: number;
  }): Promise<void> {
    const existing = await this.findByContactId(input.contactId);
    const merged = mergeContactRecord(existing ? toContactRecord(existing) : null, input);

    if (existing) {
      await existing.update(() => {
        existing._raw.display_name = merged.displayName;
        existing._raw.matrix_user_id = merged.matrixUserId;
        existing._raw.phone_number = merged.phoneNumber;
        existing._raw.source = merged.source;
        existing._raw.last_message = merged.lastMessage;
        existing._raw.is_online = merged.isOnline;
        existing._raw.updated_at = merged.updatedAt;
      });
      return;
    }

    await this.contacts.database.write(async () => {
      await this.contacts.create(record => {
        record._raw.id = merged.contactId;
        record._raw.display_name = merged.displayName;
        record._raw.matrix_user_id = merged.matrixUserId;
        record._raw.phone_number = merged.phoneNumber;
        record._raw.source = merged.source;
        record._raw.last_message = merged.lastMessage;
        record._raw.is_online = merged.isOnline;
        record._raw.updated_at = merged.updatedAt;
      });
    });
  }

  async listContacts(): Promise<ContactDirectoryRecord[]> {
    const rows = await this.contacts
      .query(Q.sortBy('updated_at', Q.desc))
      .fetch();

    return rows
      .map(toContactRecord)
      .filter((value): value is ContactDirectoryRecord => value !== null);
  }

  private async findByContactId(contactId: string): Promise<WatermelonContactModel | null> {
    const rows = await this.contacts.query(Q.where('id', contactId)).fetch();
    return rows[0] ?? null;
  }
}

export function createWatermelonContactDirectoryStore(
  database: WatermelonDatabaseLike,
): WatermelonContactDirectoryStore {
  return new WatermelonContactDirectoryStore(database.get('contacts'));
}
