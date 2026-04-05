export type PushMessagePayload = Record<string, unknown>;

export interface PushMessagingAdapter {
  requestPermission(): Promise<number>;
  getToken(): Promise<string>;
  onMessage(listener: (payload: PushMessagePayload) => void): () => void;
  setBackgroundMessageHandler(
    listener: (payload: PushMessagePayload) => Promise<void>,
  ): void;
  getInitialNotification(): Promise<PushMessagePayload | null>;
  onNotificationOpenedApp(
    listener: (payload: PushMessagePayload) => void,
  ): () => void;
}

/** Extracts a Matrix room_id from top-level or nested data field. */
function extractRoomId(payload: PushMessagePayload): string | null {
  const direct = payload['room_id'];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }
  const data = payload['data'];
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>)['room_id'];
    if (typeof nested === 'string' && nested.length > 0) {
      return nested;
    }
  }
  return null;
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
          getInitialNotification(): Promise<PushMessagePayload | null>;
          onNotificationOpenedApp(
            listener: (payload: PushMessagePayload) => void,
          ): () => void;
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
      getInitialNotification: () => messaging.getInitialNotification(),
      onNotificationOpenedApp: listener =>
        messaging.onNotificationOpenedApp(listener),
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

  async getInitialNotificationRoomId(): Promise<string | null> {
    if (!this.adapter) {
      return null;
    }
    try {
      const payload = await this.adapter.getInitialNotification();
      if (!payload) {
        return null;
      }
      return extractRoomId(payload);
    } catch {
      return null;
    }
  }

  subscribeNotificationOpen(listener: (roomId: string) => void): () => void {
    if (!this.adapter) {
      return () => {
        return;
      };
    }
    let active = true;
    const platformUnsub = this.adapter.onNotificationOpenedApp(payload => {
      if (!active) {
        return;
      }
      const roomId = extractRoomId(payload);
      if (roomId) {
        listener(roomId);
      }
    });
    return () => {
      active = false;
      platformUnsub();
    };
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

export function getInitialPushNotificationRoomId(): Promise<string | null> {
  return runtimePushService.getInitialNotificationRoomId();
}

export function subscribeNotificationOpen(
  listener: (roomId: string) => void,
): () => void {
  return runtimePushService.subscribeNotificationOpen(listener);
}
