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

export interface ConversationListScreenProps {
  conversations: ConversationPreview[];
  onSelectConversation(roomId: string): void;
  recentTargets?: string[];
  onStartRecentTarget?(target: string): Promise<void> | void;
  onRemoveRecentTarget?(target: string): Promise<void> | void;
  onClearRecentTargets?(): Promise<void> | void;
  onStartConversation?(target: string): Promise<void> | void;
  isStartingConversation?: boolean;
  startConversationError?: string;
}

type StartTargetHint = {
  text: string;
  suggestions: string[];
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

function renderUnreadBadge(unreadCount: number): React.JSX.Element | null {
  if (unreadCount <= 0) {
    return null;
  }

  return (
    <View style={styles.unreadBadge}>
      <Text style={styles.unreadText}>{unreadCount}</Text>
    </View>
  );
}

export function ConversationListScreen({
  conversations,
  onSelectConversation,
  recentTargets = [],
  onStartRecentTarget,
  onRemoveRecentTarget,
  onClearRecentTargets,
  onStartConversation,
  isStartingConversation = false,
  startConversationError,
}: ConversationListScreenProps): React.JSX.Element {
  const [target, setTarget] = React.useState('');
  const [localError, setLocalError] = React.useState<string | undefined>();
  const [isConfirmingClear, setIsConfirmingClear] = React.useState(false);
  const hint = React.useMemo(() => deriveStartTargetHint(target), [target]);

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

    setLocalError(undefined);
    void onStartConversation(parsed.target.normalized);
    setTarget('');
  }, [onStartConversation, target]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[TextPresets.h2, styles.heading]}>Chats</Text>
        <Text style={[TextPresets.caption, styles.subheading]}>
          Secure messages routed through Sauti.
        </Text>

        {onStartConversation ? (
          <View style={styles.startConversationCard}>
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
                      <Text style={styles.clearRecentTargetsText}>
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
                          <Text style={styles.removeRecentButtonText}>x</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Input
              label="Matrix ID or Room Alias"
              placeholder="@friend:server or #room:server"
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
            {localError ? (
              <Text style={styles.startError}>{localError}</Text>
            ) : null}
            {startConversationError ? (
              <Text style={styles.startError}>{startConversationError}</Text>
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

      <FlatList
        data={conversations}
        keyExtractor={item => item.roomId}
        contentContainerStyle={styles.listContent}
        renderItem={({item}) => (
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
                <Text style={styles.time}>{item.timestampLabel}</Text>
              </View>

              <View style={styles.rowBottom}>
                <Text numberOfLines={1} style={styles.preview}>
                  {item.lastMessage}
                </Text>
                {renderUnreadBadge(item.unreadCount)}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
  },
  heading: {
    color: Colors.neutral[900],
  },
  subheading: {
    color: Colors.neutral[600],
    marginTop: Spacing.xs,
  },
  startConversationCard: {
    marginTop: Spacing.base,
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  startHint: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
  },
  recentTargetsSection: {
    gap: Spacing.xs,
  },
  recentTargetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  recentTargetsLabel: {
    ...TextPresets.label,
    color: Colors.neutral[500],
  },
  clearRecentTargetsText: {
    ...TextPresets.label,
    color: Colors.brand[700],
  },
  clearConfirmHint: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
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
    borderColor: Colors.neutral[300],
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  recentTargetChipText: {
    ...TextPresets.label,
    color: Colors.neutral[700],
  },
  removeRecentButton: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[200],
  },
  removeRecentButtonText: {
    ...TextPresets.label,
    color: Colors.neutral[700],
  },
  suggestionChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    backgroundColor: Colors.brand[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  suggestionChipText: {
    ...TextPresets.label,
    color: Colors.brand[700],
  },
  startError: {
    ...TextPresets.caption,
    color: Colors.semantic.error,
  },
  listContent: {
    paddingBottom: Spacing['3xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
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
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    ...TextPresets.body,
    color: Colors.neutral[900],
    fontWeight: '600',
    flex: 1,
  },
  preview: {
    ...TextPresets.caption,
    color: Colors.neutral[600],
    flex: 1,
  },
  time: {
    ...TextPresets.label,
    color: Colors.neutral[500],
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
    borderColor: Colors.neutral[0],
  },
  presenceOnline: {
    backgroundColor: Colors.semantic.success,
  },
  presenceOffline: {
    backgroundColor: Colors.neutral[400],
  },
});
