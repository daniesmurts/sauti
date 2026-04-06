export type PushMessagePayload = Record<string, unknown>;

export type PushPermissionStatus = 'granted' | 'denied' | 'unavailable';

export interface PushMessagingAdapter {
  requestPermission(): Promise<number>;
  getToken(): Promise<string>;
  onTokenRefresh(listener: (token: string) => void): () => void;
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

interface RuntimePermissionAdapter {
  requestPermission(adapter: PushMessagingAdapter | null): Promise<PushPermissionStatus>;
}

function createRuntimePermissionAdapter(): RuntimePermissionAdapter {
  return {
    async requestPermission(adapter): Promise<PushPermissionStatus> {
      if (!adapter) {
        return 'unavailable';
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const reactNative = require('react-native') as {
          Platform: {OS: string; Version: number | string};
          PermissionsAndroid: {
            PERMISSIONS: {POST_NOTIFICATIONS: string};
            RESULTS: {GRANTED: string};
            request(permission: string): Promise<string>;
          };
        };

        if (reactNative.Platform.OS === 'android') {
          const versionRaw = reactNative.Platform.Version;
          const version = typeof versionRaw === 'number' ? versionRaw : Number(versionRaw);
          if (Number.isFinite(version) && version >= 33) {
            const requested = await reactNative.PermissionsAndroid.request(
              reactNative.PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );
            return requested === reactNative.PermissionsAndroid.RESULTS.GRANTED
              ? 'granted'
              : 'denied';
          }

          return 'granted';
        }
      } catch {
        // Fall through to messaging permission request.
      }

      try {
        const permissionStatus = await adapter.requestPermission();
        return permissionStatus > 0 ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    },
  };
}

export type PushDeviceTokenRegistrar = (token: string) => Promise<void> | void;

function createRuntimeTokenRegistrar(): PushDeviceTokenRegistrar {
  const cacheKey = 'push.device.token.v1';
  let inMemoryToken: string | null = null;

  return async (token: string) => {
    if (!token) {
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const asyncStorage = require('@react-native-async-storage/async-storage') as {
        default: {
          getItem(key: string): Promise<string | null>;
          setItem(key: string, value: string): Promise<void>;
        };
      };

      const current = await asyncStorage.default.getItem(cacheKey);
      if (current === token) {
        return;
      }

      await asyncStorage.default.setItem(cacheKey, token);
      return;
    } catch {
      inMemoryToken = token;
    }

    if (inMemoryToken !== token) {
      inMemoryToken = token;
    }
  };
}

function createRuntimeAdapter(): PushMessagingAdapter | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messagingFactory = require('@react-native-firebase/messaging').default as
      | (() => {
          requestPermission(): Promise<number>;
          getToken(): Promise<string>;
          onTokenRefresh(listener: (token: string) => void): () => void;
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
      onTokenRefresh: listener => messaging.onTokenRefresh(listener),
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
  permissionStatus: PushPermissionStatus;
  tokenRegistered: boolean;
}

export class PushNotificationService {
  private readonly registeredTokens = new Set<string>();
  private tokenRefreshUnsubscribe: (() => void) | null = null;

  constructor(
    private readonly adapter: PushMessagingAdapter | null = createRuntimeAdapter(),
    private readonly permissions: RuntimePermissionAdapter = createRuntimePermissionAdapter(),
    private readonly registerDeviceToken: PushDeviceTokenRegistrar = createRuntimeTokenRegistrar(),
  ) {}

  private ensureTokenRefreshSubscription(): void {
    if (!this.adapter || this.tokenRefreshUnsubscribe) {
      return;
    }

    this.tokenRefreshUnsubscribe = this.adapter.onTokenRefresh(token => {
      void this.registerToken(token);
    });
  }

  private async registerToken(token: string): Promise<boolean> {
    if (!token || this.registeredTokens.has(token)) {
      return false;
    }

    try {
      await this.registerDeviceToken(token);
      this.registeredTokens.add(token);
      return true;
    } catch {
      return false;
    }
  }

  async requestPermissionAndRegister(): Promise<PushNotificationInitializationResult> {
    if (!this.adapter) {
      return {
        token: null,
        permissionGranted: false,
        permissionStatus: 'unavailable',
        tokenRegistered: false,
      };
    }

    const permissionStatus = await this.permissions.requestPermission(this.adapter);
    if (permissionStatus !== 'granted') {
      return {
        token: null,
        permissionGranted: false,
        permissionStatus,
        tokenRegistered: false,
      };
    }

    try {
      const token = await this.adapter.getToken();
      const tokenRegistered = await this.registerToken(token);
      this.ensureTokenRefreshSubscription();
      return {
        token,
        permissionGranted: true,
        permissionStatus: 'granted',
        tokenRegistered,
      };
    } catch {
      return {
        token: null,
        permissionGranted: true,
        permissionStatus: 'granted',
        tokenRegistered: false,
      };
    }
  }

  async initialize(): Promise<PushNotificationInitializationResult> {
    return this.requestPermissionAndRegister();
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
let lastBackgroundRoomId: string | null = null;

export async function initializePushNotifications(): Promise<PushNotificationInitializationResult> {
  return runtimePushService.initialize();
}

export async function requestPushNotificationsPermission(): Promise<PushNotificationInitializationResult> {
  return runtimePushService.requestPermissionAndRegister();
}

export function subscribeForegroundPushMessages(
  listener: (payload: PushMessagePayload) => void,
): () => void {
  return runtimePushService.subscribeForegroundMessages(listener);
}

export function registerDefaultBackgroundPushHandler(): void {
  runtimePushService.registerBackgroundHandler(async payload => {
    const roomId = extractRoomId(payload);
    if (roomId) {
      lastBackgroundRoomId = roomId;
    }
    return;
  });
}

export async function getInitialPushNotificationRoomId(): Promise<string | null> {
  const roomId = await runtimePushService.getInitialNotificationRoomId();
  return roomId ?? lastBackgroundRoomId;
}

export function subscribeNotificationOpen(
  listener: (roomId: string) => void,
): () => void {
  return runtimePushService.subscribeNotificationOpen(listener);
}
