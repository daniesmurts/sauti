import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {
  createSessionManagementGateway,
  type SessionManagementGateway,
} from '../data/SessionManagementGateway';
import {Button, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';
import {type MatrixDeviceSession} from '../../../core/matrix/MatrixClient';

export interface SettingsSecurityScreenProps {
  gateway?: SessionManagementGateway;
}

function formatLastSeen(timestamp?: number): string {
  if (!timestamp) {
    return 'Last seen: Unknown';
  }

  return `Last seen: ${new Date(timestamp).toLocaleString()}`;
}

export function SettingsSecurityScreen({
  gateway,
}: SettingsSecurityScreenProps): React.JSX.Element {
  const resolvedGateway = React.useMemo(
    () => gateway ?? createSessionManagementGateway(),
    [gateway],
  );
  const [sessions, setSessions] = React.useState<MatrixDeviceSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = React.useState<string | null>(null);

  const loadSessions = React.useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setErrorMessage(null);
        const fetched = await resolvedGateway.listSessions();
        setSessions(fetched);
      } catch {
        setErrorMessage('Unable to load active sessions. Please retry.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [resolvedGateway],
  );

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Privacy and Security</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          <Button
            label={isRefreshing ? 'Refreshing...' : 'Refresh'}
            size="sm"
            variant="ghost"
            disabled={isRefreshing}
            onPress={() => {
              void loadSessions(true);
            }}
          />
        </View>

        {isLoading ? <Text style={styles.hint}>Loading sessions...</Text> : null}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {!isLoading && !errorMessage && sessions.length === 0 ? (
          <Text style={styles.hint}>No active sessions found.</Text>
        ) : null}

        {!isLoading && !errorMessage
          ? sessions.map(session => (
              <View key={session.deviceId} style={styles.sessionCard}>
                <Text style={styles.sessionTitle}>
                  {session.displayName ?? session.deviceId}
                </Text>
                <Text style={styles.sessionMeta}>Device ID: {session.deviceId}</Text>
                <Text style={styles.sessionMeta}>
                  IP: {session.lastSeenIp ?? 'Unknown'}
                </Text>
                <Text style={styles.sessionMeta}>{formatLastSeen(session.lastSeenTs)}</Text>
                {session.isCurrent ? (
                  <Text style={styles.currentBadge}>Current session</Text>
                ) : (
                  <Button
                    label={
                      revokingDeviceId === session.deviceId
                        ? 'Revoking...'
                        : 'Revoke session'
                    }
                    size="sm"
                    variant="secondary"
                    disabled={revokingDeviceId !== null}
                    onPress={() => {
                      setRevokingDeviceId(session.deviceId);
                      void resolvedGateway
                        .revokeSession(session.deviceId)
                        .then(() => loadSessions(true))
                        .catch(() => {
                          setErrorMessage('Unable to revoke session. Please retry.');
                        })
                        .finally(() => {
                          setRevokingDeviceId(null);
                        });
                    }}
                  />
                )}
              </View>
            ))
          : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.base,
    gap: Spacing.xs,
  },
  title: {
    ...TextPresets.h2,
    color: Colors.neutral[900],
  },
  subtitle: {
    ...TextPresets.body,
    color: Colors.neutral[600],
  },
  section: {
    marginTop: Spacing.base,
    gap: Spacing.sm,
    paddingBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...TextPresets.h3,
    color: Colors.neutral[900],
  },
  hint: {
    ...TextPresets.body,
    color: Colors.neutral[600],
  },
  error: {
    ...TextPresets.body,
    color: Colors.semantic.error,
  },
  sessionCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    gap: Spacing.xs,
  },
  sessionTitle: {
    ...TextPresets.body,
    color: Colors.neutral[900],
    fontWeight: '600',
  },
  sessionMeta: {
    ...TextPresets.label,
    color: Colors.neutral[600],
  },
  currentBadge: {
    ...TextPresets.label,
    color: Colors.semantic.success,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
});
