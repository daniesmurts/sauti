/**
 * Jest manual mock for react-native-callkeep.
 * Placed in __mocks__/ so Jest auto-resolves it for any test that imports
 * 'react-native-callkeep'.
 */

type EventHandler = (payload: Record<string, unknown>) => void;

const listeners = new Map<string, Set<EventHandler>>();

const RNCallKeep = {
  setup: jest.fn(),
  setAvailable: jest.fn(),

  displayIncomingCall: jest.fn(),
  startCall: jest.fn(),
  endCall: jest.fn(),
  rejectCall: jest.fn(),
  answerIncomingCall: jest.fn(),
  setCurrentCallActive: jest.fn(),

  addEventListener: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
  }),

  removeEventListener: jest.fn().mockImplementation((event: string, handler: EventHandler) => {
    listeners.get(event)?.delete(handler);
  }),

  /** Test helper — fire a CallKeep event programmatically. */
  _emit(event: string, payload: Record<string, unknown> = {}): void {
    listeners.get(event)?.forEach(h => h(payload));
  },

  /** Test helper — clear all registered listeners and reset call counts. */
  _reset(): void {
    listeners.clear();
    jest.clearAllMocks();
  },
};

export default RNCallKeep;
