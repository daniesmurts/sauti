/**
 * Tests for Phase 3 #4: Subscription gate in UI
 *
 * Covers:
 *  - useSubscriptionGate hook logic (via the async check function)
 *  - UpgradePromptModal rendering
 *  - NewConversationScreen gate integration
 *  - ChatRoomScreen subscription banner
 */

// ── env mock must come before any module that transitively imports MatrixClient ──
jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
    supabaseEmailRedirectUrl: 'https://matrix.sauti.ru',
  })),
}));

import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('../src/modules/subscription/api/SubscriptionStatusService');
jest.mock('../src/modules/subscription/services/FamilyService');

import {SubscriptionStatusService} from '../src/modules/subscription/api/SubscriptionStatusService';
import {FamilyService} from '../src/modules/subscription/services/FamilyService';

const MockSubscriptionStatusService =
  SubscriptionStatusService as jest.MockedClass<typeof SubscriptionStatusService>;
const MockFamilyService = FamilyService as jest.MockedClass<typeof FamilyService>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSubService(plan: 'free' | 'family', status = 'active') {
  const svc = new MockSubscriptionStatusService() as jest.Mocked<SubscriptionStatusService>;
  svc.getStatus = jest.fn().mockResolvedValue({
    matrixUserId: '@alice:sauti.ru',
    plan,
    status,
  });
  return svc;
}

function makeFamilySvc(allowed: boolean, reason = 'test') {
  const svc = new MockFamilyService() as jest.Mocked<FamilyService>;
  svc.checkEntitlement = jest.fn().mockResolvedValue({allowed, reason});
  return svc;
}

// ── 1. useSubscriptionGate ──────────────────────────────────────────────────

// We test the gate logic through a minimal React component that calls check()
// and exposes the result via testIDs, keeping tests simple without renderHook.

import {useSubscriptionGate} from '../src/modules/subscription/hooks/useSubscriptionGate';
import {Text, View, TouchableOpacity} from 'react-native';

function GateHarness({
  sender,
  recipient,
  subscriptionService,
  familyService,
}: {
  sender: string | null;
  recipient: string | null;
  subscriptionService?: SubscriptionStatusService;
  familyService?: Pick<FamilyService, 'checkEntitlement'>;
}) {
  const gate = useSubscriptionGate(sender, recipient, {
    subscriptionService,
    familyService,
  });
  return React.createElement(View, null,
    React.createElement(Text, {testID: 'gate-status'}, gate.status),
    React.createElement(Text, {testID: 'gate-reason'}, gate.reason),
    React.createElement(TouchableOpacity, {testID: 'check-btn', onPress: gate.check}),
    React.createElement(TouchableOpacity, {testID: 'reset-btn', onPress: gate.reset}),
  );
}

describe('useSubscriptionGate', () => {
  it('allows when sender has active family subscription (skips entitlement check)', async () => {
    const subSvc = makeSubService('family', 'active');
    const familySvc = makeFamilySvc(false); // would block if called

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: '@alice:sauti.ru',
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });

    expect(getByTestId('gate-status').props.children).toBe('allowed');
    expect(getByTestId('gate-reason').props.children).toBe('active_subscription');
    expect(familySvc.checkEntitlement).not.toHaveBeenCalled();
  });

  it('falls back to entitlement check when plan is free', async () => {
    const subSvc = makeSubService('free');
    const familySvc = makeFamilySvc(true, 'invited_by_payer');

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: '@alice:sauti.ru',
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });

    expect(getByTestId('gate-status').props.children).toBe('allowed');
    expect(familySvc.checkEntitlement).toHaveBeenCalledWith('@alice:sauti.ru', '@bob:sauti.ru');
  });

  it('blocks when entitlement check returns not allowed', async () => {
    const subSvc = makeSubService('free');
    const familySvc = makeFamilySvc(false);

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: '@alice:sauti.ru',
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });

    expect(getByTestId('gate-status').props.children).toBe('blocked');
    expect(getByTestId('gate-reason').props.children).toBe('subscription_required');
  });

  it('fails open (allows) when entitlement check throws a network error', async () => {
    const subSvc = makeSubService('free');
    const familySvc = new MockFamilyService() as jest.Mocked<FamilyService>;
    familySvc.checkEntitlement = jest.fn().mockRejectedValue(new Error('Network error'));

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: '@alice:sauti.ru',
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });

    expect(getByTestId('gate-status').props.children).toBe('allowed');
  });

  it('allows immediately when senderMatrixUserId is null', async () => {
    const subSvc = makeSubService('free');
    const familySvc = makeFamilySvc(false);

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: null,
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });

    expect(getByTestId('gate-status').props.children).toBe('allowed');
    expect(subSvc.getStatus).not.toHaveBeenCalled();
  });

  it('resets status back to idle', async () => {
    const subSvc = makeSubService('free');
    const familySvc = makeFamilySvc(false);

    const {getByTestId} = render(
      React.createElement(GateHarness, {
        sender: '@alice:sauti.ru',
        recipient: '@bob:sauti.ru',
        subscriptionService: subSvc,
        familyService: familySvc,
      }),
    );

    await act(async () => {
      fireEvent.press(getByTestId('check-btn'));
    });
    expect(getByTestId('gate-status').props.children).toBe('blocked');

    act(() => {
      fireEvent.press(getByTestId('reset-btn'));
    });
    expect(getByTestId('gate-status').props.children).toBe('idle');
  });
});

// ── 2. UpgradePromptModal ───────────────────────────────────────────────────

import {UpgradePromptModal} from '../src/modules/subscription/components/UpgradePromptModal';

describe('UpgradePromptModal', () => {
  it('renders correctly when visible=true', () => {
    const {getByTestId} = render(
      React.createElement(UpgradePromptModal, {
        visible: true,
        onUpgrade: jest.fn(),
        onDismiss: jest.fn(),
        blockedTarget: '@bob:sauti.ru',
      }),
    );
    expect(getByTestId('upgrade-prompt-modal')).toBeTruthy();
    expect(getByTestId('upgrade-prompt-cta')).toBeTruthy();
    expect(getByTestId('upgrade-prompt-dismiss')).toBeTruthy();
  });

  it('calls onUpgrade when CTA pressed', () => {
    const onUpgrade = jest.fn();
    const {getByTestId} = render(
      React.createElement(UpgradePromptModal, {
        visible: true,
        onUpgrade,
        onDismiss: jest.fn(),
      }),
    );
    fireEvent.press(getByTestId('upgrade-prompt-cta'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when "Not now" pressed', () => {
    const onDismiss = jest.fn();
    const {getByTestId} = render(
      React.createElement(UpgradePromptModal, {
        visible: true,
        onUpgrade: jest.fn(),
        onDismiss,
      }),
    );
    fireEvent.press(getByTestId('upgrade-prompt-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render content when visible=false', () => {
    const {queryByTestId} = render(
      React.createElement(UpgradePromptModal, {
        visible: false,
        onUpgrade: jest.fn(),
        onDismiss: jest.fn(),
      }),
    );
    // Modal is present in the tree but content is hidden
    expect(queryByTestId('upgrade-prompt-cta')).toBeNull();
  });
});

// ── 3. NewConversationScreen gate integration ───────────────────────────────

import {NewConversationScreen} from '../src/modules/main/screens/NewConversationScreen';

const baseNewConvProps = {
  conversations: [],
  onSelectConversation: jest.fn(),
  onBack: jest.fn(),
};

describe('NewConversationScreen — gate integration', () => {
  it('does NOT call onGateCheck when selecting an existing conversation from the list', () => {
    const onGateCheck = jest.fn().mockResolvedValue(true);
    const onSelectConversation = jest.fn();

    const {getByLabelText} = render(
      React.createElement(NewConversationScreen, {
        ...baseNewConvProps,
        onSelectConversation,
        onGateCheck,
        conversations: [
          {
            roomId: '!room1:sauti.ru',
            displayName: 'Bob',
            lastMessage: 'Hey',
            timestampLabel: '12:00',
            unreadCount: 0,
            isOnline: true,
          },
        ],
      }),
    );

    fireEvent.press(getByLabelText('contact-!room1:sauti.ru'));
    expect(onGateCheck).not.toHaveBeenCalled();
    expect(onSelectConversation).toHaveBeenCalledWith('!room1:sauti.ru');
  });

  it('calls onUpgradeRequired and NOT onStartConversation when gate returns false', async () => {
    const onGateCheck = jest.fn().mockResolvedValue(false);
    const onStartConversation = jest.fn();
    const onUpgradeRequired = jest.fn();

    const {getByTestId, getByLabelText} = render(
      React.createElement(NewConversationScreen, {
        ...baseNewConvProps,
        onStartConversation,
        onGateCheck,
        onUpgradeRequired,
      }),
    );

    // Type a valid Matrix target
    fireEvent.changeText(
      getByLabelText('Or start a new conversation'),
      '@carol:sauti.ru',
    );

    await act(async () => {
      fireEvent.press(getByTestId('start-chat-button'));
    });

    expect(onGateCheck).toHaveBeenCalledWith('@carol:sauti.ru');
    expect(onUpgradeRequired).toHaveBeenCalledWith('@carol:sauti.ru');
    expect(onStartConversation).not.toHaveBeenCalled();
  });

  it('calls onStartConversation normally when gate returns true', async () => {
    const onGateCheck = jest.fn().mockResolvedValue(true);
    const onStartConversation = jest.fn().mockResolvedValue(undefined);
    const onUpgradeRequired = jest.fn();
    const onBack = jest.fn();

    const {getByTestId, getByLabelText} = render(
      React.createElement(NewConversationScreen, {
        ...baseNewConvProps,
        onBack,
        onStartConversation,
        onGateCheck,
        onUpgradeRequired,
      }),
    );

    fireEvent.changeText(
      getByLabelText('Or start a new conversation'),
      '@carol:sauti.ru',
    );

    await act(async () => {
      fireEvent.press(getByTestId('start-chat-button'));
    });

    expect(onGateCheck).toHaveBeenCalledWith('@carol:sauti.ru');
    expect(onStartConversation).toHaveBeenCalledWith('@carol:sauti.ru');
    expect(onUpgradeRequired).not.toHaveBeenCalled();
  });
});

// ── 4. ChatRoomScreen subscription banner ──────────────────────────────────

import {ChatRoomScreen} from '../src/modules/main/screens/ChatRoomScreen';

const baseRoom = {roomId: '!r:sauti.ru', displayName: 'Bob', isOnline: true};
const baseChatProps = {
  room: baseRoom,
  messages: [],
  draftMessage: '',
  onBack: jest.fn(),
  onDraftChange: jest.fn(),
  onSend: jest.fn(),
};

describe('ChatRoomScreen — subscription banner', () => {
  it('renders subscription-gate-banner when subscriptionRequired=true', () => {
    const {getByTestId} = render(
      React.createElement(ChatRoomScreen, {
        ...baseChatProps,
        subscriptionRequired: true,
        onUpgradePress: jest.fn(),
      }),
    );
    expect(getByTestId('subscription-gate-banner')).toBeTruthy();
    expect(getByTestId('subscription-gate-upgrade-button')).toBeTruthy();
  });

  it('does not render subscription-gate-banner when subscriptionRequired=false', () => {
    const {queryByTestId} = render(
      React.createElement(ChatRoomScreen, {
        ...baseChatProps,
        subscriptionRequired: false,
      }),
    );
    expect(queryByTestId('subscription-gate-banner')).toBeNull();
  });

  it('does not render subscription-gate-banner when prop is omitted', () => {
    const {queryByTestId} = render(
      React.createElement(ChatRoomScreen, baseChatProps),
    );
    expect(queryByTestId('subscription-gate-banner')).toBeNull();
  });

  it('calls onUpgradePress when Subscribe button pressed', () => {
    const onUpgradePress = jest.fn();
    const {getByTestId} = render(
      React.createElement(ChatRoomScreen, {
        ...baseChatProps,
        subscriptionRequired: true,
        onUpgradePress,
      }),
    );
    fireEvent.press(getByTestId('subscription-gate-upgrade-button'));
    expect(onUpgradePress).toHaveBeenCalledTimes(1);
  });
});
