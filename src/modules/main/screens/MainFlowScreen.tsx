import React from 'react';

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
}

export function MainFlowScreen({
  gateway,
  recentTargetsStore,
  refreshIntervalMs = 4000,
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
  const [conversations, setConversations] = React.useState<ConversationPreview[]>([]);
  const [activeMessages, setActiveMessages] = React.useState<ChatMessage[]>([]);
  const [recentTargets, setRecentTargets] = React.useState<string[]>([]);
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
