import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Swipeable} from 'react-native-gesture-handler';

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

export interface ConversationListScreenProps {
  conversations: ConversationPreview[];
  onSelectConversation(roomId: string): void;
  onArchiveConversation?(roomId: string): Promise<void> | void;
  onMuteConversation?(roomId: string): Promise<void> | void;
  proxyStatus?: 'connected' | 'connecting' | 'failed' | 'disabled';
  /** True when the VPN tunnel specifically failed and the app fell back to direct connection. */
  vpnTunnelFailed?: boolean;
  onRetryProxy?(): void;
  networkState?: 'connected' | 'disconnected' | 'degraded';
  recentTargets?: string[];
  onStartRecentTarget?(target: string): Promise<void> | void;
  onRemoveRecentTarget?(target: string): Promise<void> | void;
  onClearRecentTargets?(): Promise<void> | void;
  onStartConversation?(target: string): Promise<void> | void;
  isStartingConversation?: boolean;
  startConversationError?: string;
  onOpenNewConversation?(): void;
}

function networkStatusColor(
  networkState: NonNullable<ConversationListScreenProps['networkState']>,
): string {
  return networkState === 'connected' ? Colors.semantic.success : Colors.semantic.error;
}

type StartTargetHint = {
  text: string;
  suggestions: string[];
};

type SearchableConversationResult = {
  roomId: string;
  displayName: string;
};

const CLEAR_CONFIRM_TIMEOUT_MS = 4000;

function deriveStartTargetHint(target: string): StartTargetHint {
  const normalized = target.trim();

  if (!normalized) {
    return {
      text: 'Start with @ for direct chat, # for room alias, or ! for room ID.',
      suggestions: ['@friend:example.org', '#campus:example.org', '!abc123:example.org'],
    };
  }

  if (normalized.startsWith('@')) {
    return {text: 'Direct chat target detected. Use full Matrix user ID format.', suggestions: []};
  }

  if (normalized.startsWith('#')) {
    return {text: 'Room alias detected. This will join the alias if available.', suggestions: []};
  }

  if (normalized.startsWith('!')) {
    return {text: 'Room ID detected. This will join an existing room by ID.', suggestions: []};
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

function renderUnreadBadge(unreadCount: number): React.JSX.Element | null {
  if (unreadCount <= 0) return null;
  return (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadText}>{unreadCount}</Text>
    </View>
  );
}

function findSearchableConversations(
  conversations: ConversationPreview[],
  query: string,
): SearchableConversationResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return conversations.slice(0, 5).map(c => ({roomId: c.roomId, displayName: c.displayName}));
  }
  return conversations
    .filter(c => c.displayName.toLowerCase().includes(normalized))
    .slice(0, 5)
    .map(c => ({roomId: c.roomId, displayName: c.displayName}));
}

type FilterTabType = 'all' | 'contacts' | 'finance' | 'unknown';

const FILTER_TABS: Array<{key: FilterTabType; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'contacts', label: 'Contacts'},
  {key: 'finance', label: 'Finance'},
  {key: 'unknown', label: 'Unknown'},
];

export function ConversationListScreen({
  conversations,
  onSelectConversation,
  onArchiveConversation,
  onMuteConversation,
  proxyStatus = 'disabled',
  vpnTunnelFailed = false,
  onRetryProxy,
  networkState = 'connected',
  recentTargets = [],
  onStartRecentTarget,
  onRemoveRecentTarget,
  onClearRecentTargets,
  onStartConversation,
  isStartingConversation = false,
  startConversationError,
  onOpenNewConversation,
}: ConversationListScreenProps): React.JSX.Element {
  const [target, setTarget] = React.useState('');
  const [localError, setLocalError] = React.useState<string | undefined>();
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [archivedRoomIds, setArchivedRoomIds] = React.useState<string[]>([]);
  const [mutedRoomIds, setMutedRoomIds] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFilter, setSelectedFilter] = React.useState<FilterTabType>('all');

  const hint = React.useMemo(() => deriveStartTargetHint(target), [target]);

  const visibleConversations = React.useMemo(
    () => conversations.filter(c => !archivedRoomIds.includes(c.roomId)),
    [archivedRoomIds, conversations],
  );

  const filteredConversations = React.useMemo(() => {
    let filtered = visibleConversations;
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(c => c.displayName.toLowerCase().includes(lowerQuery));
    }
    return filtered;
  }, [visibleConversations, searchQuery, selectedFilter]);

  const searchableConversations = React.useMemo(
    () => findSearchableConversations(visibleConversations, target),
    [visibleConversations, target],
  );

  const handleArchiveConversation = React.useCallback(
    (roomId: string) => {
      setArchivedRoomIds(current => (current.includes(roomId) ? current : [...current, roomId]));
      void onArchiveConversation?.(roomId);
    },
    [onArchiveConversation],
  );

  const handleMuteConversation = React.useCallback(
    (roomId: string) => {
      setMutedRoomIds(current =>
        current.includes(roomId) ? current.filter(id => id !== roomId) : [...current, roomId],
      );
      void onMuteConversation?.(roomId);
    },
    [onMuteConversation],
  );

  React.useEffect(() => {
    if (recentTargets.length === 0 && isConfirmingClear) setIsConfirmingClear(false);
  }, [isConfirmingClear, recentTargets.length]);

  React.useEffect(() => {
    if (!isConfirmingClear) return;
    const timeout = setTimeout(() => setIsConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [isConfirmingClear]);

  const handleStartConversation = React.useCallback(() => {
    if (!onStartConversation) return;
    const parsed = parseMatrixConversationTarget(target);
    if (!parsed.ok) {
      setLocalError(parsed.error);
      return;
    }
    setLocalError(undefined);
    void onStartConversation(parsed.target.normalized);
    setTarget('');
    setIsComposerOpen(false);
  }, [onStartConversation, target]);

  const netColor = networkStatusColor(networkState);

  return (
    <Screen dark>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Chats</Text>
          {/* Compact connection indicator */}
          <View style={[styles.connectionDot, {backgroundColor: netColor}]} />
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Input
            label=""
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            dark
          />
        </View>

        {/* Filter tabs */}
        <View style={styles.filterTabs}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`filter-tab-${tab.key}`}
              accessibilityState={{selected: selectedFilter === tab.key}}
              style={[styles.filterTab, selectedFilter === tab.key && styles.filterTabActive]}
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

        {/* VPN warning */}
        {vpnTunnelFailed ? (
          <View style={styles.vpnWarningCard} testID="vpn-tunnel-failure-warning">
            <View style={styles.vpnWarningBody}>
              <Text style={styles.vpnWarningTitle}>VPN tunnel failed — running unprotected</Text>
              <Text style={styles.vpnWarningDetail}>
                The secure proxy could not start. Tap Retry to attempt reconnection.
              </Text>
            </View>
            {onRetryProxy ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="retry-proxy"
                activeOpacity={0.85}
                onPress={onRetryProxy}
                style={styles.vpnRetryButton}>
                <Text style={styles.vpnRetryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {networkState === 'degraded' ? (
          <Text style={styles.degradedHint}>
            Network is degraded. Messages will retry automatically.
          </Text>
        ) : null}

        {/* New conversation composer */}
        {onStartConversation && isComposerOpen ? (
          <View style={styles.composerCard}>
            <View style={styles.composerHeader}>
              <Text style={styles.composerTitle}>New Conversation</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="close-new-conversation"
                activeOpacity={0.85}
                onPress={() => {
                  setIsComposerOpen(false);
                  setTarget('');
                  setLocalError(undefined);
                  setIsConfirmingClear(false);
                }}>
                <Text style={styles.closeComposerText}>Close</Text>
              </TouchableOpacity>
            </View>

            {searchableConversations.length > 0 ? (
              <View style={styles.searchResultsSection}>
                <Text style={styles.searchResultsLabel}>Contacts</Text>
                <View style={styles.searchResultsList}>
                  {searchableConversations.map(result => (
                    <TouchableOpacity
                      key={result.roomId}
                      accessibilityRole="button"
                      accessibilityLabel={`search-contact-result-${result.roomId}`}
                      style={styles.searchResultRow}
                      activeOpacity={0.85}
                      onPress={() => {
                        setIsComposerOpen(false);
                        setTarget('');
                        setLocalError(undefined);
                        onSelectConversation(result.roomId);
                      }}>
                      <Avatar name={result.displayName} size="sm" />
                      <Text style={styles.searchResultText}>{result.displayName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {recentTargets.length > 0 ? (
              <View style={styles.recentTargetsSection}>
                <View style={styles.recentTargetsHeader}>
                  <Text style={styles.recentTargetsLabel}>Recent</Text>
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
                      <Text style={styles.clearRecentText}>
                        {isConfirmingClear ? 'Confirm' : 'Clear'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {isConfirmingClear ? (
                  <Text style={styles.clearConfirmHint}>Tap Confirm again to clear.</Text>
                ) : null}
                <View style={styles.suggestionRow}>
                  {recentTargets.map(recentTarget => (
                    <View key={recentTarget} style={styles.recentTargetWrap}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`recent-target-chip-${recentTarget}`}
                        style={styles.recentTargetChip}
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
                        <Text style={styles.recentTargetChipText}>{recentTarget}</Text>
                      </TouchableOpacity>
                      {onRemoveRecentTarget ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`remove-recent-target-${recentTarget}`}
                          style={styles.removeRecentButton}
                          activeOpacity={0.85}
                          onPress={() => {
                            setIsConfirmingClear(false);
                            void onRemoveRecentTarget(recentTarget);
                          }}>
                          <Text style={styles.removeRecentText}>×</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Input
              label="Search contacts or Matrix target"
              placeholder="@friend:server or #room:server"
              value={target}
              onChangeText={value => {
                setTarget(value);
                if (localError) setLocalError(undefined);
                if (isConfirmingClear) setIsConfirmingClear(false);
              }}
              editable={!isStartingConversation}
              dark
            />
            <Text style={styles.startHint}>{hint.text}</Text>
            {hint.suggestions.length > 0 ? (
              <View style={styles.suggestionRow}>
                {hint.suggestions.map(suggestion => (
                  <TouchableOpacity
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityLabel={`start-target-suggestion-${suggestion}`}
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
            {localError ? <Text style={styles.startError}>{localError}</Text> : null}
            {startConversationError ? (
              <Text style={styles.startError}>{startConversationError}</Text>
            ) : null}
            {searchableConversations.length === 0 && target.trim().length > 0 ? (
              <Text style={styles.searchEmptyHint}>
                No matching contacts. Enter a full Matrix target to start a new chat.
              </Text>
            ) : null}
            <Button
              label="Start Chat"
              size="sm"
              loading={isStartingConversation}
              disabled={isStartingConversation || target.trim().length === 0}
              onPress={handleStartConversation}
            />
          </View>
        ) : null}
      </View>

      {/* ── Conversation list ── */}
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.roomId}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
          <Swipeable
            overshootRight={false}
            renderRightActions={() => (
              <View style={styles.rowActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`mute-conversation-${item.roomId}`}
                  style={[styles.rowActionButton, styles.rowActionMute]}
                  activeOpacity={0.85}
                  onPress={() => handleMuteConversation(item.roomId)}>
                  <Text style={styles.rowActionText}>
                    {mutedRoomIds.includes(item.roomId) ? 'Unmute' : 'Mute'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`archive-conversation-${item.roomId}`}
                  style={[styles.rowActionButton, styles.rowActionArchive]}
                  activeOpacity={0.85}
                  onPress={() => handleArchiveConversation(item.roomId)}>
                  <Text style={styles.rowActionText}>Archive</Text>
                </TouchableOpacity>
              </View>
            )}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`conversation-row-${item.roomId}`}
              activeOpacity={0.8}
              style={styles.row}
              onPress={() => onSelectConversation(item.roomId)}>
              <View>
                <Avatar name={item.displayName} size="md" />
                <View
                  style={[
                    styles.presenceDot,
                    item.isOnline ? styles.presenceOnline : styles.presenceOffline,
                  ]}
                />
              </View>

              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.displayName}
                  </Text>
                  <View style={styles.rowMetaGroup}>
                    {mutedRoomIds.includes(item.roomId) ? (
                      <Text style={styles.mutedBadge}>Muted</Text>
                    ) : null}
                    <Text style={styles.time}>{item.timestampLabel}</Text>
                  </View>
                </View>

                <View style={styles.rowBottom}>
                  <Text numberOfLines={1} style={styles.preview}>
                    {item.lastMessage}
                  </Text>
                  {renderUnreadBadge(item.unreadCount)}
                </View>
              </View>
            </TouchableOpacity>
          </Swipeable>
        )}
      />

      {/* ── FAB ── */}
      {onStartConversation ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="open-new-conversation"
          activeOpacity={0.9}
          style={styles.fab}
          onPress={() => {
            if (onOpenNewConversation) {
              onOpenNewConversation();
            } else {
              setIsComposerOpen(true);
              setLocalError(undefined);
              setIsConfirmingClear(false);
            }
          }}>
          <Text style={styles.fabPlus}>+</Text>
          <Text style={styles.fabLabel}>New</Text>
        </TouchableOpacity>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral[0],
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  searchContainer: {
    marginTop: Spacing.xs,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterTab: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.neutral[800],
    borderWidth: 1,
    borderColor: Colors.neutral[700],
  },
  filterTabActive: {
    backgroundColor: Colors.brand[900],
    borderColor: Colors.brand[600],
  },
  filterTabText: {
    ...TextPresets.label,
    color: Colors.neutral[400],
  },
  filterTabTextActive: {
    color: Colors.brand[300],
    fontWeight: '600',
  },
  composerCard: {
    marginTop: Spacing.xs,
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.neutral[800],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neutral[700],
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  composerTitle: {
    ...TextPresets.body,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
  closeComposerText: {
    ...TextPresets.label,
    color: Colors.brand[400],
  },
  startHint: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  searchResultsSection: {gap: Spacing.xs},
  searchResultsLabel: {
    ...TextPresets.label,
    color: Colors.neutral[500],
  },
  searchResultsList: {gap: Spacing.xs},
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[700],
  },
  searchResultText: {
    ...TextPresets.body,
    color: Colors.neutral[50],
  },
  degradedHint: {
    ...TextPresets.caption,
    color: Colors.semantic.warning,
  },
  recentTargetsSection: {gap: Spacing.xs},
  recentTargetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTargetsLabel: {
    ...TextPresets.label,
    color: Colors.neutral[500],
  },
  clearRecentText: {
    ...TextPresets.label,
    color: Colors.brand[400],
  },
  clearConfirmHint: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  recentTargetWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  recentTargetChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neutral[600],
    backgroundColor: Colors.neutral[800],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  recentTargetChipText: {
    ...TextPresets.label,
    color: Colors.neutral[300],
  },
  removeRecentButton: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[700],
  },
  removeRecentText: {
    ...TextPresets.label,
    color: Colors.neutral[400],
  },
  suggestionChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.brand[700],
    backgroundColor: Colors.brand[900],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  suggestionChipText: {
    ...TextPresets.label,
    color: Colors.brand[300],
  },
  startError: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
  searchEmptyHint: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
  },
  listContent: {
    paddingBottom: Spacing['3xl'] + 72,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[800],
  },
  rowBody: {
    flex: 1,
    gap: Spacing.xxs,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    ...TextPresets.body,
    color: Colors.neutral[0],
    fontWeight: '600',
    flex: 1,
  },
  preview: {
    ...TextPresets.caption,
    color: Colors.neutral[500],
    flex: 1,
  },
  time: {
    ...TextPresets.label,
    color: Colors.neutral[600],
  },
  mutedBadge: {
    ...TextPresets.label,
    color: Colors.semantic.warning,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginVertical: Spacing.xs,
  },
  rowActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 84,
    paddingHorizontal: Spacing.sm,
  },
  rowActionMute: {
    backgroundColor: Colors.semantic.warning,
  },
  rowActionArchive: {
    backgroundColor: Colors.neutral[700],
  },
  rowActionText: {
    ...TextPresets.label,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.brand[500],
  },
  unreadText: {
    ...TextPresets.label,
    color: Colors.neutral[0],
  },
  presenceDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.neutral[900],
  },
  presenceOnline: {
    backgroundColor: Colors.semantic.success,
  },
  presenceOffline: {
    backgroundColor: Colors.neutral[700],
  },
  fab: {
    position: 'absolute',
    right: Spacing.base,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.brand[500],
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    shadowColor: Colors.brand[500],
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPlus: {
    ...TextPresets.body,
    color: Colors.neutral[0],
    fontWeight: '700',
  },
  fabLabel: {
    ...TextPresets.label,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
  vpnWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.semantic.error,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  vpnWarningBody: {
    flex: 1,
    gap: Spacing.xxs,
  },
  vpnWarningTitle: {
    ...TextPresets.label,
    color: Colors.semantic.error,
    fontWeight: '600',
  },
  vpnWarningDetail: {
    ...TextPresets.caption,
    color: Colors.neutral[400],
  },
  vpnRetryButton: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.semantic.error,
  },
  vpnRetryText: {
    ...TextPresets.label,
    color: Colors.neutral[0],
    fontWeight: '600',
  },
});
