import React from 'react';

import {getCoreAppRuntime} from '../../../core/runtime';
import {Platform} from 'react-native';
import {SautiError} from '../../../core/matrix';
import {logger} from '../../../utils/logger';

import {
  buildChatStartCandidates,
  createRuntimeContactsDirectoryGateway,
  createRuntimeRecentConversationTargetsStore,
  createRuntimeMainMessagingGateway,
  resolveChatStartInput,
  type ContactPreview,
  type ContactsDirectoryGateway,
  type MainMessagingGateway,
  type RecentConversationTargetsStore,
} from '../data';
import {ChatRoomScreen, type ChatMessage} from './ChatRoomScreen';
import {
  ConversationListScreen,
  type ConversationPreview,
} from './ConversationListScreen';
import {NewConversationScreen} from './NewConversationScreen';

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
  contactsGateway?: ContactsDirectoryGateway;
  recentTargetsStore?: RecentConversationTargetsStore;
  refreshIntervalMs?: number;
  /** Room ID to open immediately — delivered from a push notification tap. */
  initialRoomId?: string;
  /** Called once the room from initialRoomId has been opened, so the caller can clear the pending value. */
  onRoomOpened?: () => void;
  /** Friendly input requested by another entry point (for example Contacts tab). */
  initialStartInput?: string;
  /** Called once initialStartInput has been consumed. */
  onStartInputHandled?: () => void;
}

function toStartConversationErrorMessage(error: unknown): string {
  if (error instanceof SautiError && error.code === 'MATRIX_ROOM_OPERATION_FAILED') {
    const causeMessage =
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'message' in error.cause &&
      typeof (error.cause as {message?: unknown}).message === 'string'
        ? (error.cause as {message: string}).message
        : '';

    if (causeMessage.includes('502')) {
      return 'Matrix server is temporarily unavailable (502). Please retry in a minute.';
    }

    if (causeMessage.toLowerCase().includes('network request failed')) {
      return 'Network path to Matrix failed. Check emulator DNS/proxy and retry.';
    }

    return 'Unable to contact Matrix server right now. Please retry shortly.';
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('network request failed')) {
      return 'Network path to Matrix failed. Check emulator DNS/proxy and retry.';
    }

    return error.message;
  }

  return 'Unable to start conversation.';
}

export function MainFlowScreen({
  gateway,
  contactsGateway,
  recentTargetsStore,
  refreshIntervalMs = 4000,
  initialRoomId,
  onRoomOpened,
  initialStartInput,
  onStartInputHandled,
}: MainFlowScreenProps): React.JSX.Element {
  const resolvedGateway = React.useMemo(
    () => gateway ?? createRuntimeMainMessagingGateway(),
    [gateway],
  );
  const resolvedContactsGateway = React.useMemo(
    () => contactsGateway ?? createRuntimeContactsDirectoryGateway(),
    [contactsGateway],
  );
  const resolvedRecentTargetsStore = React.useMemo(
    () => recentTargetsStore ?? createRuntimeRecentConversationTargetsStore(),
    [recentTargetsStore],
  );

  const [activeRoomId, setActiveRoomId] = React.useState<string | null>(null);
  const [draftMessage, setDraftMessage] = React.useState('');
  const [isNewConversationScreenOpen, setIsNewConversationScreenOpen] = React.useState(false);

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
  const [contacts, setContacts] = React.useState<ContactPreview[]>([]);
  const [recentTargets, setRecentTargets] = React.useState<string[]>([]);
  const [proxyStatus, setProxyStatus] = React.useState<
    'connected' | 'connecting' | 'failed' | 'disabled'
  >('disabled');
  const [networkState, setNetworkState] = React.useState<
    'connected' | 'disconnected' | 'degraded'
  >('connected');
  const [startConversationError, setStartConversationError] = React.useState<string | undefined>();
  const [isStartingConversation, setIsStartingConversation] = React.useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = React.useState(false);
  const [lastHandledStartInput, setLastHandledStartInput] = React.useState<string | undefined>();
  const [prefilledStartTarget, setPrefilledStartTarget] = React.useState<string | undefined>();

  const refreshConversations = React.useCallback(async () => {
    try {
      const fetchedConversations = await resolvedGateway.listConversations();
      setConversations(fetchedConversations);
      await resolvedContactsGateway.syncFromConversations(fetchedConversations);
      setContacts(await resolvedContactsGateway.listContacts());
    } catch (error) {
      logger.warn('Failed to refresh conversations', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Keep previous conversations on refresh failure rather than clearing.
      try {
        setContacts(await resolvedContactsGateway.listContacts());
      } catch {
        // Keep previous contacts when cache read also fails.
      }
    } finally {
      setHasLoadedConversations(true);
    }
  }, [resolvedContactsGateway, resolvedGateway]);

  const refreshActiveRoomMessages = React.useCallback(async () => {
    if (!activeRoomId) {
      setActiveMessages([]);
      return;
    }

    try {
      const fetchedMessages = await resolvedGateway.listRoomMessages(activeRoomId);
      setActiveMessages(fetchedMessages);
    } catch (error) {
      logger.warn('Failed to refresh room messages', {
        roomId: activeRoomId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Keep previous messages on refresh failure rather than clearing
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
    type NetworkState = 'connected' | 'disconnected' | 'degraded';
    type NetworkMonitorShape = {
      getState(): NetworkState;
      subscribe(listener: (state: NetworkState) => void): () => void;
      start(): void;
      stop(): void;
    };

    let unsubscribe = () => {
      return;
    };
    let monitor: NetworkMonitorShape | null = null;

    try {
      // Lazy require keeps NetInfo native dependency out of tests unless available.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetworkMonitor = require('../../../core/network').NetworkMonitor as {
        new (): NetworkMonitorShape;
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

  const [sendError, setSendError] = React.useState<string | undefined>();

  const chatStartCandidates = React.useMemo(
    () => buildChatStartCandidates({contacts, conversations}),
    [contacts, conversations],
  );

  const handleSend = React.useCallback(async () => {
    if (!activeRoomId) {
      return;
    }

    const normalized = draftMessage.trim();
    if (normalized.length === 0) {
      return;
    }

    setSendError(undefined);
    try {
      await resolvedGateway.sendText(activeRoomId, normalized);
      setDraftMessage('');
      await refreshActiveRoomMessages();
      await refreshConversations();
    } catch (error) {
      logger.error('Failed to send message', {
        roomId: activeRoomId,
        error: error instanceof Error ? error.message : String(error),
      });
      setSendError('Message failed to send. Tap Send to retry.');
    }
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
        setStartConversationError(toStartConversationErrorMessage(error));
      } finally {
        setIsStartingConversation(false);
      }
    },
    [refreshConversations, resolvedGateway, resolvedRecentTargetsStore],
  );

  React.useEffect(() => {
    if (!initialStartInput) {
      return;
    }

    if (!hasLoadedConversations) {
      return;
    }

    if (lastHandledStartInput === initialStartInput) {
      return;
    }

    setLastHandledStartInput(initialStartInput);
    const resolution = resolveChatStartInput(initialStartInput, chatStartCandidates);

    if (resolution.kind === 'existing_room') {
      setStartConversationError(undefined);
      setDraftMessage('');
      setPrefilledStartTarget(undefined);
      setActiveRoomId(resolution.roomId);
      onStartInputHandled?.();
      return;
    }

    if (resolution.kind === 'matrix_target') {
      setPrefilledStartTarget(undefined);
      void handleStartConversation(resolution.target).finally(() => {
        onStartInputHandled?.();
      });
      return;
    }

    if (resolution.kind === 'ambiguous') {
      setStartConversationError(undefined);
      setPrefilledStartTarget(initialStartInput);
      setIsNewConversationScreenOpen(true);
      onStartInputHandled?.();
      return;
    }

    setPrefilledStartTarget(undefined);
    setStartConversationError('Could not auto-start chat from contact. Try New Chat.');
    onStartInputHandled?.();
  }, [
    chatStartCandidates,
    handleStartConversation,
    hasLoadedConversations,
    initialStartInput,
    lastHandledStartInput,
    onStartInputHandled,
  ]);

  if (isNewConversationScreenOpen) {
    return (
      <NewConversationScreen
        conversations={conversations}
        chatStartCandidates={chatStartCandidates}
        initialTarget={prefilledStartTarget}
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
          setPrefilledStartTarget(undefined);
          setStartConversationError(undefined);
          setActiveRoomId(roomId);
          setIsNewConversationScreenOpen(false);
        }}
        onBack={() => {
          setPrefilledStartTarget(undefined);
          setIsNewConversationScreenOpen(false);
        }}
      />
    );
  }

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
        onOpenNewConversation={() => {
          setPrefilledStartTarget(undefined);
          setIsNewConversationScreenOpen(true);
        }}
      />
    );
  }

  return (
    <ChatRoomScreen
      room={activeConversation}
      messages={activeMessages}
      draftMessage={draftMessage}
      sendError={sendError}
      onBack={() => {
        setDraftMessage('');
        setSendError(undefined);
        setActiveRoomId(null);
      }}
      onDraftChange={value => {
        setDraftMessage(value);
        if (sendError) {
          setSendError(undefined);
        }
      }}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
