import {createWatermelonContactStore, type ContactDirectoryRecord} from '../../../core/db';
import {getCoreDatabase} from '../../../core/runtime';

import {type ConversationPreview} from '../screens/ConversationListScreen';
import {type ChatStartConversationCandidate} from './ChatStartResolver';

export interface ContactPreview {
  id: string;
  name: string;
  subtitle: string;
  matrixUserId?: string;
  phoneNumber?: string;
  source: 'conversation_sync' | 'directory_import' | 'manual';
  isOnline: boolean;
}

export interface ContactsDirectoryGateway {
  listContacts(): Promise<ContactPreview[]>;
  syncFromConversations(conversations: ConversationPreview[]): Promise<void>;
}

export function buildChatStartCandidates(input: {
  contacts: ContactPreview[];
  conversations: ConversationPreview[];
}): ChatStartConversationCandidate[] {
  const ordered = new Map<string, ChatStartConversationCandidate>();

  for (const contact of input.contacts) {
    ordered.set(contact.id, {
      roomId: contact.id,
      displayName: contact.name,
    });
  }

  for (const conversation of input.conversations) {
    if (ordered.has(conversation.roomId)) {
      continue;
    }

    ordered.set(conversation.roomId, {
      roomId: conversation.roomId,
      displayName: conversation.displayName,
    });
  }

  return [...ordered.values()];
}

export function buildContactSearchText(contact: ContactPreview): string {
  return [contact.name, contact.matrixUserId, contact.phoneNumber, contact.subtitle]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function toContactPreview(record: ContactDirectoryRecord): ContactPreview {
  return {
    id: record.contactId,
    name: record.displayName,
    subtitle: record.lastMessage ?? 'No messages yet',
    matrixUserId: record.matrixUserId,
    phoneNumber: record.phoneNumber,
    source: record.source,
    isOnline: record.isOnline,
  };
}

export class RuntimeContactsDirectoryGateway implements ContactsDirectoryGateway {
  async listContacts(): Promise<ContactPreview[]> {
    const store = createWatermelonContactStore(getCoreDatabase());
    const records = await store.listContacts();
    return records.map(toContactPreview);
  }

  async syncFromConversations(conversations: ConversationPreview[]): Promise<void> {
    const store = createWatermelonContactStore(getCoreDatabase());
    const existing = await store.listContacts();
    const existingById = new Map(existing.map(contact => [contact.contactId, contact]));
    const now = Date.now();

    for (const conversation of conversations) {
      const current = existingById.get(conversation.roomId);
      const mergedDisplayName = conversation.displayName.trim() || current?.displayName || 'Unknown';
      const mergedLastMessage = conversation.lastMessage || current?.lastMessage || 'No messages yet';
      const mergedOnline = conversation.isOnline || current?.isOnline === true;

      await store.upsertContact({
        contactId: conversation.roomId,
        displayName: mergedDisplayName,
        matrixUserId: current?.matrixUserId,
        phoneNumber: current?.phoneNumber,
        source: 'conversation_sync',
        lastMessage: mergedLastMessage,
        isOnline: mergedOnline,
        updatedAt: now,
      });
    }
  }
}

export function createRuntimeContactsDirectoryGateway(): ContactsDirectoryGateway {
  return new RuntimeContactsDirectoryGateway();
}
