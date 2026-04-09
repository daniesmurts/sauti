import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Button, Screen} from '../../../ui/components';
import {Colors, Spacing} from '../../../ui/tokens';
import {familyService, type FamilyInvite} from '../services/FamilyService';
import {logger} from '../../../utils/logger';

export interface FamilyMembersScreenProps {
  payerMatrixUserId: string;
  service?: typeof familyService;
}

type ScreenPhase =
  | {phase: 'loading'}
  | {phase: 'ready'; invites: FamilyInvite[]}
  | {phase: 'error'; message: string};

const STATUS_LABELS: Record<FamilyInvite['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
};

const STATUS_COLORS: Record<FamilyInvite['status'], string> = {
  pending: Colors.semantic.warning,
  accepted: Colors.semantic.success,
  revoked: Colors.neutral[400],
};

export function FamilyMembersScreen({
  payerMatrixUserId,
  service = familyService,
}: FamilyMembersScreenProps): React.JSX.Element {
  const [screenPhase, setPhase] = React.useState<ScreenPhase>({phase: 'loading'});
  const [inviting, setInviting] = React.useState(false);

  const loadInvites = React.useCallback(async () => {
    setPhase({phase: 'loading'});
    try {
      const invites = await service.getMyInvites(payerMatrixUserId);
      setPhase({phase: 'ready', invites});
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load family members.';
      logger.error('FamilyMembersScreen: failed to load invites', {message});
      setPhase({phase: 'error', message});
    }
  }, [service, payerMatrixUserId]);

  React.useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleInvite = React.useCallback(async () => {
    setInviting(true);
    try {
      const invite = await service.createInvite(payerMatrixUserId);
      await Share.share({
        message: `Join my Sauti family plan: ${invite.deepLink}`,
        url: invite.deepLink,
      });
      // Reload to show newly created invite
      await loadInvites();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create invite.';
      logger.error('FamilyMembersScreen: failed to create invite', {message});
      Alert.alert('Error', message);
    } finally {
      setInviting(false);
    }
  }, [service, payerMatrixUserId, loadInvites]);

  const handleRevoke = React.useCallback(
    (invite: FamilyInvite) => {
      Alert.alert(
        'Revoke Invite',
        'Are you sure you want to revoke this invite? The person will lose access.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              try {
                await service.revokeInvite(invite.id, payerMatrixUserId);
                await loadInvites();
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : 'Failed to revoke invite.';
                logger.error('FamilyMembersScreen: failed to revoke invite', {message});
                Alert.alert('Error', message);
              }
            },
          },
        ],
      );
    },
    [service, payerMatrixUserId, loadInvites],
  );

  const renderInvite = React.useCallback(
    ({item}: {item: FamilyInvite}) => (
      <View
        testID={`family-member-row-${item.id}`}
        style={styles.row}
      >
        <View style={styles.rowInfo}>
          <Text style={styles.inviteeText}>
            {item.inviteeMatrixUserId ?? 'Awaiting acceptance'}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {backgroundColor: STATUS_COLORS[item.status]},
            ]}
          >
            <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevoke(item)}
            accessibilityLabel="Revoke invite"
          >
            <Text style={styles.revokeButtonText}>Revoke</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    [handleRevoke],
  );

  const renderEmpty = React.useCallback(
    () => (
      <View testID="family-empty-state" style={styles.emptyState}>
        <Text style={styles.emptyStateText}>
          No family members yet. Invite a contact to share your subscription.
        </Text>
      </View>
    ),
    [],
  );

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.heading}>Family Members</Text>

        <Button
          testID="family-invite-button"
          label={inviting ? 'Creating invite…' : 'Invite a contact'}
          onPress={handleInvite}
          disabled={inviting}
        />

        {screenPhase.phase === 'loading' && (
          <ActivityIndicator
            size="large"
            color={Colors.brand[500]}
            style={styles.spinner}
          />
        )}

        {screenPhase.phase === 'error' && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>{screenPhase.message}</Text>
            <Button label="Retry" onPress={loadInvites} />
          </View>
        )}

        {screenPhase.phase === 'ready' && (
          <FlatList
            testID="family-screen-list"
            data={screenPhase.invites}
            keyExtractor={item => item.id}
            renderItem={renderInvite}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.base,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: Spacing.base,
  },
  spinner: {
    marginTop: Spacing['2xl'],
  },
  listContent: {
    flexGrow: 1,
    paddingTop: Spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.neutral[0],
    borderRadius: 8,
    marginBottom: Spacing.sm,
    shadowColor: Colors.neutral[900],
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  rowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteeText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[800],
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.neutral[0],
  },
  revokeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    backgroundColor: Colors.semantic.errorBg,
    marginLeft: Spacing.sm,
  },
  revokeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.semantic.error,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  errorState: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.semantic.error,
    textAlign: 'center',
  },
});
