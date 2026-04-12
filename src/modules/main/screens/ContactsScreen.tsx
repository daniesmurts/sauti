import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {Avatar, Input, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';
import {
  buildContactSearchText,
  createRuntimeContactsDirectoryGateway,
  createRuntimeMainMessagingGateway,
  type ContactPreview,
  type ContactsDirectoryGateway,
  type MainMessagingGateway,
} from '../data';

export interface ContactsScreenProps {
  onStartChat?(chatInput: string): void;
  gateway?: Pick<MainMessagingGateway, 'listConversations'>;
  contactsGateway?: ContactsDirectoryGateway;
  refreshIntervalMs?: number;
}

export function ContactsScreen({
  onStartChat,
  gateway,
  contactsGateway,
  refreshIntervalMs = 8000,
}: ContactsScreenProps): React.JSX.Element {
  const resolvedGateway = React.useMemo(
    () => gateway ?? createRuntimeMainMessagingGateway(),
    [gateway],
  );
  const resolvedContactsGateway = React.useMemo(
    () => contactsGateway ?? createRuntimeContactsDirectoryGateway(),
    [contactsGateway],
  );
  const [query, setQuery] = React.useState('');
  const [contacts, setContacts] = React.useState<ContactPreview[]>([]);

  React.useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const conversations = await resolvedGateway.listConversations();
        await resolvedContactsGateway.syncFromConversations(conversations);
        const cachedContacts = await resolvedContactsGateway.listContacts();
        if (!active) {
          return;
        }

        setContacts(cachedContacts);
      } catch {
        const cachedContacts = await resolvedContactsGateway.listContacts().catch(() => []);
        if (active) {
          setContacts(cachedContacts);
        }
      }
    };

    void refresh();

    if (refreshIntervalMs <= 0) {
      return () => {
        active = false;
      };
    }

    const timer = setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshIntervalMs, resolvedContactsGateway, resolvedGateway]);

  const filteredContacts = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return contacts;
    }

    return contacts.filter(contact => buildContactSearchText(contact).includes(normalized));
  }, [contacts, query]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>Find people and start secure chats quickly.</Text>
      </View>

      <Input
        accessibilityLabel="contacts-search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search contacts"
      />

      <FlatList
        style={styles.list}
        data={filteredContacts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.contentContainer}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`open-contact-${item.id}`}
            onPress={() => onStartChat?.(item.id)}>
            <Avatar name={item.name} size="md" />

            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.matrixUserId ?? item.phoneNumber ?? item.subtitle}
              </Text>
            </View>

            <View
              style={[
                styles.statusDot,
                item.isOnline ? styles.statusOnline : styles.statusOffline,
              ]}
            />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No contacts found</Text>
            <Text style={styles.emptySubtitle}>Try a different name or phone number.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.base,
    gap: Spacing.xxs,
  },
  title: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  subtitle: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  list: {
    marginTop: Spacing.base,
  },
  contentContainer: {
    gap: Spacing.sm,
    paddingBottom: Spacing['2xl'],
  },
  row: {
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...TextPresets.body,
    fontWeight: '600',
    color: Colors.neutral[800],
  },
  rowSubtitle: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  statusOnline: {
    backgroundColor: Colors.semantic.success,
  },
  statusOffline: {
    backgroundColor: Colors.neutral[300],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xxs,
  },
  emptyTitle: {
    ...TextPresets.body,
    color: Colors.neutral[700],
    fontWeight: '600',
  },
  emptySubtitle: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
});
