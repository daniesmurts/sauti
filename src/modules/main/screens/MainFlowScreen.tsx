import React from 'react';

import {getCoreAppRuntime} from '../../../core/runtime';
import {Platform} from 'react-native';

import {
  createRuntimeRecentConversationTargetsStore,
  createRuntimeMainMessagingGateway,
  type MainMessagingGateway,
  type RecentConversationTargetsStore,
} from '../data';
import {ChatRoomScreen, type ChatMessage} from './ChatRoomScreen';
import {
  ConversationListScreen,
  type ConversationPreview,
} from './ConversationListScreen';

const fallbackConversation: ConversationPreview = {
  roomId: 'room-unavailable',
  displayName: 'Conversation',
  lastMessage: '',
  timestampLabel: '-',
  unreadCount: 0,
  isOnline: false,
};

export interface MainFlowScreenProps {
  gateway?: MainMessagingGateway;
  recentTargetsStore?: RecentConversationTargetsStore;
  refreshIntervalMs?: number;
  /** Room ID to open immediately — delivered from a push notification tap. */
  initialRoomId?: string;
  /** Called once the room from initialRoomId has been opened, so the caller can clear the pending value. */
  onRoomOpened?: () => void;
}

export function MainFlowScreen({
  gateway,
  recentTargetsStore,
  refreshIntervalMs = 4000,
  initialRoomId,
  onRoomOpened,
}: MainFlowScreenProps): React.JSX.Element {
  const resolvedGateway = React.useMemo(
    () => gateway ?? createRuntimeMainMessagingGateway(),
    [gateway],
  );
  const resolvedRecentTargetsStore = React.useMemo(
    () => recentTargetsStore ?? createRuntimeRecentConversationTargetsStore(),
    [recentTargetsStore],
  );

  const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
  const [draftMessage, setDraftMessage] = React.useState('');

  // Navigate to room when a push notification tap delivers an initialRoomId.
  React.useEffect(() => {
    if (initialRoomId) {
      setActiveRoomId(initialRoomId);
      setDraftMessage('');
      onRoomOpened?.();
    }
  }, [initialRoomId, onRoomOpened]);
  const [conversations, setConversations] = React.useState<ConversationPreview[]>([]);
  const [activeMessages, setActiveMessages] = React.useState<ChatMessage[]>([]);
  const [recentTargets, setRecentTargets] = React.useState<string[]>([]);
  const [proxyStatus, setProxyStatus] = React.useState<
    'connected' | 'connecting' | 'failed' | 'disabled'
  >('disabled');
  const [networkState, setNetworkState] = React.useState<
    'connected' | 'disconnected' | 'degraded'
  >('connected');
  const [startConversationError, setStartConversationError] = React.useState<string | undefined>();
  const [isStartingConversation, setIsStartingConversation] = React.useState(false);

  const refreshConversations = React.useCallback(async () => {
    try {
      const fetchedConversations = await resolvedGateway.listConversations();
      setConversations(fetchedConversations);
    } catch {
      setConversations([]);
    }
  }, [resolvedGateway]);

  const refreshActiveRoomMessages = React.useCallback(async () => {
    if (!activeRoomId) {
      setActiveMessages([]);
      return;
    }

    try {
      const fetchedMessages = await resolvedGateway.listRoomMessages(activeRoomId);
      setActiveMessages(fetchedMessages);
    } catch {
      setActiveMessages([]);
    }
  }, [activeRoomId, resolvedGateway]);

  React.useEffect(() => {
    void refreshConversations();

    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      void refreshConversations();
    }, refreshIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [refreshConversations, refreshIntervalMs]);

  React.useEffect(() => {
    void resolvedRecentTargetsStore
      .listTargets()
      .then(setRecentTargets)
      .catch(() => {
        setRecentTargets([]);
      });
  }, [resolvedRecentTargetsStore]);

  React.useEffect(() => {
    void refreshActiveRoomMessages();
  }, [refreshActiveRoomMessages]);

  React.useEffect(() => {
    let unsubscribe = () => {
      return;
    };

    try {
      const runtime = getCoreAppRuntime();
      setProxyStatus(runtime.getLifecycleSnapshot().proxyStatus);
      unsubscribe = runtime.subscribeLifecycle(event => {
        if (event.type === 'proxyStatusChanged') {
          setProxyStatus(event.status);
        }
      });
    } catch {
      setProxyStatus('disabled');
    }

    return () => {
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    let unsubscribe = () => {
      return;
    };
    let monitor: {start(): void; stop(): void} | null = null;

    try {
      // Lazy require keeps NetInfo native dependency out of tests unless available.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetworkMonitor = require('../../../core/network').NetworkMonitor as {
        new (): {
          getState(): 'connected' | 'disconnected' | 'degraded';
          subscribe(
            listener: (state: 'connected' | 'disconnected' | 'degraded') => void,
          ): () => void;
          start(): void;
          stop(): void;
        };
      };

      monitor = new NetworkMonitor();
      setNetworkState(monitor.getState());
      unsubscribe = monitor.subscribe(state => {
        setNetworkState(state);
      });
      monitor.start();
    } catch {
      setNetworkState('connected');
    }

    return () => {
      unsubscribe();
      monitor?.stop();
    };
  }, []);

  const activeConversation = React.useMemo(() => {
    if (!activeRoomId) {
      return null;
    }

    return (
      conversations.find(conversation => conversation.roomId === activeRoomId) ?? {
        ...fallbackConversation,
        roomId: activeRoomId,
      }
    );
  }, [activeRoomId, conversations]);

  const handleSend = React.useCallback(async () => {
    if (!activeRoomId) {
      return;
    }

    const normalized = draftMessage.trim();
    if (normalized.length === 0) {
      return;
    }

    await resolvedGateway.sendText(activeRoomId, normalized);
    setDraftMessage('');
    await refreshActiveRoomMessages();
    await refreshConversations();
  }, [
    activeRoomId,
    draftMessage,
    refreshActiveRoomMessages,
    refreshConversations,
    resolvedGateway,
  ]);

  const handleStartConversation = React.useCallback(
    async (target: string) => {
      setStartConversationError(undefined);
      setIsStartingConversation(true);

      try {
        const created = await resolvedGateway.startConversation(target);
        await resolvedRecentTargetsStore.addTarget(target);
        const latestTargets = await resolvedRecentTargetsStore.listTargets();
        setRecentTargets(latestTargets);
        setActiveRoomId(created.roomId);
        setDraftMessage('');
        await refreshConversations();
      } catch (error) {
        setStartConversationError(
          error instanceof Error ? error.message : 'Unable to start conversation.',
        );
      } finally {
        setIsStartingConversation(false);
      }
    },
    [refreshConversations, resolvedGateway, resolvedRecentTargetsStore],
  );

  if (!activeConversation) {
    return (
      <ConversationListScreen
        conversations={conversations}
        proxyStatus={proxyStatus}
        vpnTunnelFailed={Platform.OS === 'android' && proxyStatus === 'failed'}
        onRetryProxy={() => {
          setProxyStatus('connecting');
          try {
            const runtime = getCoreAppRuntime();
            void runtime.recover().catch(() => {
              setProxyStatus('failed');
            });
          } catch {
            setProxyStatus('failed');
          }
        }}
        networkState={networkState}
        recentTargets={recentTargets}
        onStartRecentTarget={target => {
          void handleStartConversation(target);
        }}
        onRemoveRecentTarget={target => {
          void resolvedRecentTargetsStore
            .removeTarget(target)
            .then(() => resolvedRecentTargetsStore.listTargets())
            .then(setRecentTargets)
            .catch(() => {
              // keep previous state on storage failures
            });
        }}
        onClearRecentTargets={() => {
          void resolvedRecentTargetsStore
            .clearTargets()
            .then(() => {
              setRecentTargets([]);
            })
            .catch(() => {
              // keep previous state on storage failures
            });
        }}
        onStartConversation={handleStartConversation}
        isStartingConversation={isStartingConversation}
        startConversationError={startConversationError}
        onSelectConversation={roomId => {
          setDraftMessage('');
          setStartConversationError(undefined);
          setActiveRoomId(roomId);
        }}
      />
    );
  }

  return (
    <ChatRoomScreen
      room={activeConversation}
      messages={activeMessages}
      draftMessage={draftMessage}
      onBack={() => {
        setDraftMessage('');
        setActiveRoomId(null);
      }}
      onDraftChange={setDraftMessage}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
