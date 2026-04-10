import React from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';

import {Avatar, Input, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';
import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';

type CallDirection = 'incoming' | 'outgoing' | 'missed';

type CallItem = {
  id: string;
  name: string;
  direction: CallDirection;
  when: string;
};

const CALLS: CallItem[] = [
  {id: 'c1', name: 'Amina Diallo', direction: 'incoming', when: 'Today, 09:42'},
  {id: 'c2', name: 'Kwame Asante', direction: 'missed', when: 'Today, 08:11'},
  {id: 'c3', name: 'Fatou Njeri', direction: 'outgoing', when: 'Yesterday, 22:34'},
  {id: 'c4', name: 'Yared Bekele', direction: 'incoming', when: 'Yesterday, 17:03'},
  {id: 'c5', name: 'Zahra Osman', direction: 'missed', when: 'Yesterday, 14:55'},
];

function directionLabel(direction: CallDirection): string {
  if (direction === 'incoming') {
    return 'Incoming';
  }

  if (direction === 'outgoing') {
    return 'Outgoing';
  }

  return 'Missed';
}

function directionColor(direction: CallDirection): string {
  if (direction === 'missed') {
    return Colors.semantic.error;
  }

  return Colors.neutral[500];
}

export function CallLogScreen(): React.JSX.Element {
  useScreenCaptureProtection(true);
  const [query, setQuery] = React.useState('');

  const filteredCalls = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return CALLS;
    }

    return CALLS.filter(item => item.name.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <Screen testID="call-log-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Calls</Text>
        <Text style={styles.subtitle}>Recent secure voice activity.</Text>
      </View>

      <Input
        accessibilityLabel="calls-search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search calls"
      />

      <FlatList
        style={styles.list}
        data={filteredCalls}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.contentContainer}
        renderItem={({item}) => (
          <View style={styles.row}>
            <Avatar name={item.name} size="md" />

            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={[styles.direction, {color: directionColor(item.direction)}]}>
                {directionLabel(item.direction)}
              </Text>
            </View>

            <Text style={styles.when}>{item.when}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No calls found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term.</Text>
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
  direction: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  when: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
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
