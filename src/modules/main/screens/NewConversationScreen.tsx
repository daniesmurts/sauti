import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {Avatar, Button, Input, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';
import {parseMatrixConversationTarget} from '../data';

export interface ConversationPreview {
  roomId: string;
  displayName: string;
  lastMessage: string;
  timestampLabel: string;
  unreadCount: number;
  isOnline: boolean;
}

export interface NewConversationScreenProps {
  conversations: ConversationPreview[];
  onSelectConversation(roomId: string): void;
  recentTargets?: string[];
  onStartRecentTarget?(target: string): Promise<void> | void;
  onRemoveRecentTarget?(target: string): Promise<void> | void;
  onClearRecentTargets?(): Promise<void> | void;
  onStartConversation?(target: string): Promise<void> | void;
  isStartingConversation?: boolean;
  startConversationError?: string;
  onBack(): void;
  /**
   * When provided, called before starting a new raw-target conversation.
   * Return true to allow, false to block (triggers onUpgradeRequired).
   * Not called when selecting an existing conversation from the contact list.
   */
  onGateCheck?(target: string): Promise<boolean>;
  /** True while onGateCheck is running. */
  isGateChecking?: boolean;
  /** Called when onGateCheck returns false. */
  onUpgradeRequired?(target: string): void;
}

type FilterTabType = 'all' | 'contacts' | 'finance' | 'unknown';

const FILTER_TABS: Array<{key: FilterTabType; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'contacts', label: 'Contacts'},
  {key: 'finance', label: 'Finance'},
  {key: 'unknown', label: 'Unknown'},
];

const CLEAR_CONFIRM_TIMEOUT_MS = 4000;

function deriveStartTargetHint(target: string): {text: string; suggestions: string[]} {
  const normalized = target.trim();

  if (!normalized) {
    return {
      text: 'Start with @ for direct chat, # for room alias, or ! for room ID.',
      suggestions: ['@friend:example.org', '#campus:example.org', '!abc123:example.org'],
    };
  }

  if (normalized.startsWith('@')) {
    return {
      text: 'Direct chat target detected. Use full Matrix user ID format.',
      suggestions: [],
    };
  }

  if (normalized.startsWith('#')) {
    return {
      text: 'Room alias detected. This will join the alias if available.',
      suggestions: [],
    };
  }

  if (normalized.startsWith('!')) {
    return {
      text: 'Room ID detected. This will join an existing room by ID.',
      suggestions: [],
    };
  }

  if (normalized.includes(':')) {
    return {
      text: 'Missing Matrix prefix. Tap a suggestion to autocomplete.',
      suggestions: [`@${normalized}`, `#${normalized}`, `!${normalized}`],
    };
  }

  return {
    text: 'Add a homeserver domain after colon, e.g. @friend:example.org.',
    suggestions: [],
  };
}

export function NewConversationScreen({
  conversations,
  onSelectConversation,
  recentTargets = [],
  onStartRecentTarget,
  onRemoveRecentTarget,
  onClearRecentTargets,
  onStartConversation,
  isStartingConversation = false,
  startConversationError,
  onBack,
  onGateCheck,
  isGateChecking = false,
  onUpgradeRequired,
}: NewConversationScreenProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [localError, setLocalError] = React.useState<string | undefined>();
  const [selectedFilter, setSelectedFilter] = React.useState<FilterTabType>('all');
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);

  const hint = React.useMemo(() => deriveStartTargetHint(target), [target]);

  const filteredContacts = React.useMemo(() => {
    let filtered = conversations;

    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(conversation =>
        conversation.displayName.toLowerCase().includes(lowerQuery),
      );
    }

    // Filter by category (can be extended when conversations have category metadata)
    if (selectedFilter === 'contacts') {
      // Could filter to direct messages only in future
    } else if (selectedFilter === 'finance') {
      // Could filter to finance-related rooms in future
    } else if (selectedFilter === 'unknown') {
      // Could filter to uncategorized conversations in future
    }

    return filtered;
  }, [conversations, searchQuery, selectedFilter]);

  React.useEffect(() => {
    if (recentTargets.length === 0 && isConfirmingClear) {
      setIsConfirmingClear(false);
    }
  }, [isConfirmingClear, recentTargets.length]);

  React.useEffect(() => {
    if (!isConfirmingClear) {
      return;
    }

    const timeout = setTimeout(() => {
      setIsConfirmingClear(false);
    }, CLEAR_CONFIRM_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isConfirmingClear]);

  const handleStartConversation = React.useCallback(() => {
    if (!onStartConversation) {
      return;
    }

    const parsed = parseMatrixConversationTarget(target);
    if (!parsed.ok) {
      setLocalError(parsed.error);
      return;
    }

    const normalizedTarget = parsed.target.normalized;
    setLocalError(undefined);

    if (onGateCheck) {
      void (async () => {
        const allowed = await onGateCheck(normalizedTarget);
        if (!allowed) {
          onUpgradeRequired?.(normalizedTarget);
          return;
        }
        void onStartConversation(normalizedTarget);
        setTarget('');
        onBack();
      })();
      return;
    }

    void onStartConversation(normalizedTarget);
    setTarget('');
    onBack();
  }, [onStartConversation, target, onBack, onGateCheck, onUpgradeRequired]);

  const handleSelectContact = React.useCallback(
    (roomId: string) => {
      onSelectConversation(roomId);
      onBack();
    },
    [onSelectConversation, onBack],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="back-to-conversations"
            activeOpacity={0.7}
            onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[TextPresets.h2, styles.heading]}>New Chat</Text>
          <View style={{width: 60}} />
        </View>

        <View style={styles.searchContainer}>
          <Input
            label=""
            placeholder="Search contacts or Matrix target"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterTabs}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`filter-tab-${tab.key}`}
              accessibilityState={{selected: selectedFilter === tab.key}}
              style={[
                styles.filterTab,
                selectedFilter === tab.key && styles.filterTabActive,
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedFilter(tab.key)}>
              <Text
                style={[
                  styles.filterTabText,
                  selectedFilter === tab.key && styles.filterTabTextActive,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filteredContacts.length > 0 ? (
        <FlatList
          data={filteredContacts}
          keyExtractor={item => item.roomId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>
              {searchQuery.trim() ? 'Search Results' : 'All Contacts'}
            </Text>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`contact-${item.roomId}`}
              activeOpacity={0.8}
              style={styles.contactRow}
              onPress={() => handleSelectContact(item.roomId)}>
              <View>
                <Avatar name={item.displayName} size="md" />
                <View
                  style={[
                    styles.presenceDot,
                    item.isOnline ? styles.presenceOnline : styles.presenceOffline,
                  ]}
                />
              </View>

              <View style={styles.contactBody}>
                <Text numberOfLines={1} style={styles.contactName}>
                  {item.displayName}
                </Text>
                <Text numberOfLines={1} style={styles.contactPreview}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>

              <Text style={styles.contactTime}>{item.timestampLabel}</Text>
            </TouchableOpacity>
          )}
        />
      ) : searchQuery.trim() ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No contacts found</Text>
          <Text style={styles.emptyStateSubtitle}>
            Enter a full Matrix target to start a new chat
          </Text>
        </View>
      ) : null}

      {recentTargets.length > 0 ? (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentLabel}>Recent</Text>
            {onClearRecentTargets ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="clear-recent-targets"
                activeOpacity={0.85}
                onPress={() => {
                  if (!isConfirmingClear) {
                    setIsConfirmingClear(true);
                    return;
                  }

                  setIsConfirmingClear(false);
                  void onClearRecentTargets();
                }}>
                <Text style={styles.clearButtonText}>
                  {isConfirmingClear ? 'Confirm' : 'Clear'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {isConfirmingClear ? (
            <Text style={styles.clearConfirmHint}>
              Tap Confirm again to clear all recent targets.
            </Text>
          ) : null}
          <View style={styles.recentChips}>
            {recentTargets.map(recentTarget => (
              <View key={recentTarget} style={styles.recentChipWrap}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`recent-target-${recentTarget}`}
                  style={styles.recentChip}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (onStartRecentTarget) {
                      void onStartRecentTarget(recentTarget);
                      return;
                    }
                    setTarget(recentTarget);
                    setLocalError(undefined);
                    setIsConfirmingClear(false);
                  }}>
                  <Text style={styles.recentChipText}>{recentTarget}</Text>
                </TouchableOpacity>
                {onRemoveRecentTarget ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`remove-recent-${recentTarget}`}
                    style={styles.removeChipButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      setIsConfirmingClear(false);
                      void onRemoveRecentTarget(recentTarget);
                    }}>
                    <Text style={styles.removeChipText}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Input
          label="Or start a new conversation"
          placeholder="@user:server.com"
          value={target}
          onChangeText={value => {
            setTarget(value);
            if (localError) {
              setLocalError(undefined);
            }
            if (isConfirmingClear) {
              setIsConfirmingClear(false);
            }
          }}
          editable={!isStartingConversation}
        />
        <Text style={styles.hint}>{hint.text}</Text>
        {hint.suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {hint.suggestions.map(suggestion => (
              <TouchableOpacity
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={`suggestion-${suggestion}`}
                style={styles.suggestionChip}
                activeOpacity={0.85}
                onPress={() => {
                  setTarget(suggestion);
                  setLocalError(undefined);
                  setIsConfirmingClear(false);
                }}>
                <Text style={styles.suggestionChipText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {startConversationError ? (
          <Text style={styles.error}>{startConversationError}</Text>
        ) : null}
        <Button
          label="Start Chat"
          size="sm"
          loading={isStartingConversation || isGateChecking}
          disabled={isStartingConversation || isGateChecking || target.trim().length === 0}
          onPress={handleStartConversation}
          testID="start-chat-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  backButton: {
    ...TextPresets.label,
    color: Colors.brand[700],
    fontWeight: '600',
  },
  heading: {
    color: Colors.neutral[900],
  },
  searchContainer: {
    marginBottom: 0,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: 0,
  },
  filterTab: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  filterTabActive: {
    backgroundColor: Colors.brand[100],
    borderColor: Colors.brand[300],
  },
  filterTabText: {
    ...TextPresets.label,
    color: Colors.neutral[700],
  },
  filterTabTextActive: {
    color: Colors.brand[700],
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  sectionLabel: {
    ...TextPresets.label,
    color: Colors.neutral[500],
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  contactBody: {
    flex: 1,
    gap: Spacing.xxs,
  },
  contactName: {
    ...TextPresets.body,
    color: Colors.neutral[900],
    fontWeight: '600',
  },
  contactPreview: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
  },
  contactTime: {
    ...TextPresets.label,
    color: Colors.neutral[500],
  },
  presenceDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.neutral[0],
  },
  presenceOnline: {
    backgroundColor: Colors.semantic.success,
  },
  presenceOffline: {
    backgroundColor: Colors.neutral[400],
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    ...TextPresets.body,
    color: Colors.neutral[700],
    fontWeight: '600',
  },
  emptyStateSubtitle: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 0,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    gap: Spacing.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  recentLabel: {
    ...TextPresets.label,
    color: Colors.neutral[600],
    fontWeight: '600',
  },
  clearButtonText: {
    ...TextPresets.label,
    color: Colors.brand[700],
    fontWeight: '600',
  },
  clearConfirmHint: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
    marginBottom: Spacing.sm,
  },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  recentChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  recentChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    backgroundColor: Colors.brand[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  recentChipText: {
    ...TextPresets.label,
    color: Colors.brand[700],
  },
  removeChipButton: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[200],
  },
  removeChipText: {
    ...TextPresets.label,
    color: Colors.neutral[700],
  },
  footer: {
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    gap: Spacing.sm,
  },
  hint: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  suggestionChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.brand[300],
    backgroundColor: Colors.brand[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  suggestionChipText: {
    ...TextPresets.label,
    color: Colors.brand[700],
  },
  error: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
});
