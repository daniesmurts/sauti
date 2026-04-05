import React from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';

import {
  AuthGatewayPlaceholder,
  initializeApp,
  MainGatewayPlaceholder,
} from './src/app';
import {initializePushNotifications} from './src/core/notifications';

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
    void initializePushNotifications();
  }, []);

  if (state.status === 'main') {
    return <MainGatewayPlaceholder />;
  }

  if (state.status === 'auth') {
    return <AuthGatewayPlaceholder />;
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
});

export default App;
