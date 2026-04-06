import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  AuthGatewayPlaceholder,
  initializeApp,
  MainGatewayPlaceholder,
} from './src/app';
import {
  initializePushNotifications,
  requestPushNotificationsPermission,
  subscribeForegroundPushMessages,
} from './src/core/notifications';

type AppShellStatus = 'initializing' | 'main' | 'auth' | 'error';

interface AppShellState {
  status: AppShellStatus;
  detail?: string;
}

const initialState: AppShellState = {
  status: 'initializing',
};

function formatSignedOutReason(reason?: string): string {
  if (!reason) {
    return 'Session unavailable.';
  }

  switch (reason) {
    case 'session_missing':
      return 'Session missing.';
    case 'session_expired':
      return 'Session expired.';
    case 'session_invalid':
      return 'Session invalid.';
    default:
      return 'Session unavailable.';
  }
}

function App(): React.JSX.Element {
  const [state, setState] = React.useState<AppShellState>(initialState);
  const [pushPermissionPromptVisible, setPushPermissionPromptVisible] = React.useState(false);
  const [pushPromptMessage, setPushPromptMessage] = React.useState(
    'Enable notifications so you can receive new message alerts.',
  );
  const [foregroundNotice, setForegroundNotice] = React.useState<string | null>(null);
  const [isRequestingPushPermission, setIsRequestingPushPermission] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await initializeApp();
        if (cancelled) {
          return;
        }

        if (result.startup.status === 'ready') {
          setState({
            status: 'main',
            detail: 'Core runtime ready.',
          });
          return;
        }

        if (result.startup.status === 'signed_out') {
          setState({
            status: 'auth',
            detail: formatSignedOutReason(result.startup.reason),
          });
          return;
        }

        setState({
          status: 'error',
          detail: result.startup.errorMessage ?? 'Startup failed.',
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: 'error',
          detail: error instanceof Error ? error.message : 'Startup failed.',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let active = true;

    void initializePushNotifications().then(result => {
      if (!active) {
        return;
      }

      if (result.permissionStatus !== 'granted') {
        setPushPermissionPromptVisible(true);
        setPushPromptMessage(
          result.permissionStatus === 'unavailable'
            ? 'Notifications are not available on this build yet.'
            : 'Enable notifications so you can receive new message alerts.',
        );
      }
    });

    const unsubscribe = subscribeForegroundPushMessages(payload => {
      const roomId =
        typeof payload['room_id'] === 'string'
          ? payload['room_id']
          : payload['data'] && typeof payload['data'] === 'object'
            ? ((payload['data'] as Record<string, unknown>)['room_id'] as string | undefined)
            : undefined;

      setForegroundNotice(
        roomId ? `New message received for ${roomId}` : 'New message received.',
      );
      setTimeout(() => {
        setForegroundNotice(current => (current ? null : current));
      }, 3500);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleRequestNotificationPermission = React.useCallback(() => {
    setIsRequestingPushPermission(true);
    void requestPushNotificationsPermission()
      .then(result => {
        if (result.permissionStatus === 'granted') {
          setPushPermissionPromptVisible(false);
          return;
        }

        setPushPermissionPromptVisible(true);
        setPushPromptMessage('Notifications are still disabled. You can retry anytime.');
      })
      .finally(() => {
        setIsRequestingPushPermission(false);
      });
  }, []);

  const renderNotificationOverlays = (): React.JSX.Element => (
    <>
      {pushPermissionPromptVisible ? (
        <View style={styles.pushPromptCard}>
          <Text style={styles.pushPromptTitle}>Notifications Off</Text>
          <Text style={styles.pushPromptMessage}>{pushPromptMessage}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="enable-notifications"
            style={styles.pushPromptButton}
            activeOpacity={0.88}
            onPress={handleRequestNotificationPermission}
            disabled={isRequestingPushPermission}>
            <Text style={styles.pushPromptButtonText}>
              {isRequestingPushPermission ? 'Requesting...' : 'Enable Notifications'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {foregroundNotice ? (
        <View style={styles.foregroundNoticeCard}>
          <Text style={styles.foregroundNoticeText}>{foregroundNotice}</Text>
        </View>
      ) : null}
    </>
  );

  if (state.status === 'main') {
    return (
      <View style={styles.gatewayContainer}>
        <MainGatewayPlaceholder />
        {renderNotificationOverlays()}
      </View>
    );
  }

  if (state.status === 'auth') {
    return (
      <View style={styles.gatewayContainer}>
        <AuthGatewayPlaceholder />
        {renderNotificationOverlays()}
      </View>
    );
  }

  const title =
    state.status === 'initializing' ? 'Initializing Sauti' : 'Startup Error';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>
          {state.detail ?? 'Starting core services...'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gatewayContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  detail: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'center',
  },
  pushPromptCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7aa6bd',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  pushPromptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  pushPromptMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  pushPromptButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#23718d',
    paddingVertical: 10,
    alignItems: 'center',
  },
  pushPromptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  foregroundNoticeCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 50,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  foregroundNoticeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default App;
