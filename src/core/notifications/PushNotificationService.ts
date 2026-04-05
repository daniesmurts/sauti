export type PushMessagePayload = Record<string, unknown>;

export interface PushMessagingAdapter {
  requestPermission(): Promise<number>;
  getToken(): Promise<string>;
  onMessage(listener: (payload: PushMessagePayload) => void): () => void;
  setBackgroundMessageHandler(
    listener: (payload: PushMessagePayload) => Promise<void>,
  ): void;
}

function createRuntimeAdapter(): PushMessagingAdapter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingFactory = require('@react-native-firebase/messaging').default as
      | (() => {
          requestPermission(): Promise<number>;
          getToken(): Promise<string>;
          onMessage(listener: (payload: PushMessagePayload) => void): () => void;
          setBackgroundMessageHandler(
            listener: (payload: PushMessagePayload) => Promise<void>,
          ): void;
        })
      | undefined;

    if (!messagingFactory) {
      return null;
    }

    const messaging = messagingFactory();
    return {
      requestPermission: () => messaging.requestPermission(),
      getToken: () => messaging.getToken(),
      onMessage: listener => messaging.onMessage(listener),
      setBackgroundMessageHandler: listener =>
        messaging.setBackgroundMessageHandler(listener),
    };
  } catch {
    return null;
  }
}

export interface PushNotificationInitializationResult {
  token: string | null;
  permissionGranted: boolean;
}

export class PushNotificationService {
  constructor(private readonly adapter: PushMessagingAdapter | null = createRuntimeAdapter()) {}

  async initialize(): Promise<PushNotificationInitializationResult> {
    if (!this.adapter) {
      return {token: null, permissionGranted: false};
    }

    try {
      const permissionStatus = await this.adapter.requestPermission();
      const permissionGranted = permissionStatus > 0;
      if (!permissionGranted) {
        return {token: null, permissionGranted: false};
      }

      const token = await this.adapter.getToken();
      return {token, permissionGranted: true};
    } catch {
      return {token: null, permissionGranted: false};
    }
  }

  subscribeForegroundMessages(
    listener: (payload: PushMessagePayload) => void,
  ): () => void {
    if (!this.adapter) {
      return () => {
        return;
      };
    }

    return this.adapter.onMessage(listener);
  }

  registerBackgroundHandler(
    listener: (payload: PushMessagePayload) => Promise<void>,
  ): void {
    if (!this.adapter) {
      return;
    }

    this.adapter.setBackgroundMessageHandler(listener);
  }
}

const runtimePushService = new PushNotificationService();

export async function initializePushNotifications(): Promise<PushNotificationInitializationResult> {
  return runtimePushService.initialize();
}

export function subscribeForegroundPushMessages(
  listener: (payload: PushMessagePayload) => void,
): () => void {
  return runtimePushService.subscribeForegroundMessages(listener);
}

export function registerDefaultBackgroundPushHandler(): void {
  runtimePushService.registerBackgroundHandler(async () => {
    // Placeholder handler for Phase-1 wiring. Domain logic will be added with notifications UX.
    return;
  });
}
