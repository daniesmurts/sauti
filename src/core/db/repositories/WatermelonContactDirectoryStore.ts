import {Q} from '@nozbe/watermelondb';

export interface ContactDirectoryRecord {
  contactId: string;
  displayName: string;
  lastMessage?: string;
  isOnline: boolean;
  updatedAt: number;
}

export interface ContactDirectoryStore {
  upsertContact(input: {
    contactId: string;
    displayName: string;
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
    last_message?: string;
    is_online?: boolean;
    updated_at?: number;
  };
  update(updater: () => void): Promise<void>;
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
    lastMessage?: string;
    isOnline?: boolean;
    updatedAt: number;
  }): Promise<void> {
    const existing = await this.findByContactId(input.contactId);

    if (existing) {
      await existing.update(() => {
        existing._raw.display_name = input.displayName;
        existing._raw.last_message = input.lastMessage;
        existing._raw.is_online = input.isOnline === true;
        existing._raw.updated_at = input.updatedAt;
      });
      return;
    }

    await this.contacts.database.write(async () => {
      await this.contacts.create(record => {
        record._raw.id = input.contactId;
        record._raw.display_name = input.displayName;
        record._raw.last_message = input.lastMessage;
        record._raw.is_online = input.isOnline === true;
        record._raw.updated_at = input.updatedAt;
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
