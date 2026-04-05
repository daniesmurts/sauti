import {createClient, MatrixClient as MatrixSdkClient} from 'matrix-js-sdk';

export type SautiErrorCode =
  | 'MATRIX_INIT_FAILED'
  | 'MATRIX_MISSING_CLIENT'
  | 'MATRIX_HOMESERVER_UNREACHABLE'
  | 'MATRIX_LOGIN_FAILED'
  | 'MATRIX_LOGOUT_FAILED'
  | 'MATRIX_TOKEN_REFRESH_FAILED'
  | 'MATRIX_RECONNECT_FAILED'
  | 'MATRIX_SYNC_START_FAILED'
  | 'MATRIX_SYNC_STOP_FAILED'
  | 'MATRIX_SYNC_TOKEN_PERSIST_FAILED'
  | 'MATRIX_E2EE_INIT_FAILED'
  | 'MATRIX_KEY_BACKUP_FAILED'
  | 'MATRIX_DEVICE_VERIFICATION_FAILED'
  | 'MATRIX_RUNTIME_START_FAILED'
  | 'MATRIX_RUNTIME_STOP_FAILED'
  | 'MATRIX_RUNTIME_RECOVERY_FAILED'
  | 'MATRIX_CONFIG_INVALID'
  | 'MATRIX_BOOT_FAILED'
  | 'MATRIX_SESSION_STORE_FAILED'
  | 'MATRIX_SESSION_MISSING'
  | 'MATRIX_SESSION_INVALID'
  | 'MATRIX_SESSION_EXPIRED'
  | 'MATRIX_LOGOUT_CLEANUP_FAILED'
  | 'MATRIX_STARTUP_FAILED'
  | 'MATRIX_LIFECYCLE_WAIT_TIMEOUT'
  | 'MATRIX_ROOM_OPERATION_FAILED'
  | 'MATRIX_TOKEN_REFRESH_LIFECYCLE_FAILED'
  | 'AUTH_REGISTRATION_FAILED'
  | 'AUTH_BOOTSTRAP_FAILED'
  | 'SUBSCRIPTION_FETCH_FAILED'
  | 'SUBSCRIPTION_CACHE_FAILED';

export class SautiError extends Error {
  code: SautiErrorCode;
  cause?: unknown;

  constructor(code: SautiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'SautiError';
    this.code = code;
    this.cause = cause;
  }
}

export interface MatrixClientInitOptions {
  baseUrl: string;
  userId: string;
  accessToken: string;
  deviceId?: string;
  fetchFn?: typeof fetch;
}

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export type MatrixClientEvent =
  | {type: 'syncStateChanged'; state: string}
  | {type: 'connectionStateChanged'; state: ConnectionState}
  | {type: 'authStateChanged'; state: 'logged_in' | 'logged_out'}
  | {
      type: 'roomStateChanged';
      roomId: string;
      roomName?: string;
      topic?: string;
      timestamp: number;
    }
  | {
      type: 'roomMessageReceived';
      roomId: string;
      eventId: string;
      senderId: string;
      body: string;
      msgType: string;
      timestamp: number;
    }
  | {
      type: 'roomMembershipChanged';
      roomId: string;
      membership: string;
      previousMembership?: string;
      roomName?: string;
      topic?: string;
      isDirect?: boolean;
    };

export interface MatrixLoginResult {
  accessToken: string;
  userId: string;
  deviceId?: string;
  refreshToken?: string;
}

export interface MatrixSsoLoginOptions {
  redirectUrl: string;
  idpId?: string;
}

export interface MatrixCreateConversationOptions {
  inviteeUserId: string;
  name?: string;
  topic?: string;
}

export interface MatrixConversationResult {
  roomId: string;
}

export interface MatrixRoomSnapshot {
  roomId: string;
  roomName?: string;
  topic?: string;
  isDirect?: boolean;
  lastEventAt?: number;
}

export interface MatrixReconnectOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
}

type MatrixEventHandler = (event: MatrixClientEvent) => void;

interface MatrixSdkAuthLoginResponse {
  access_token: string;
  user_id: string;
  device_id?: string;
  refresh_token?: string;
}

interface MatrixAuthClientShape {
  login?: (
    loginType: string,
    data: Record<string, unknown>,
  ) => Promise<MatrixSdkAuthLoginResponse>;
  logout?: () => Promise<unknown>;
  startClient?: () => void;
  stopClient?: () => void;
  getSsoLoginUrl?: (redirectUrl: string, loginType?: string, idpId?: string) => string;
  createRoom?: (options: {
    invite?: string[];
    is_direct?: boolean;
    name?: string;
    topic?: string;
    preset?: string;
  }) => Promise<{room_id?: string}>;
  joinRoom?: (roomIdOrAlias: string) => Promise<{roomId?: string; room_id?: string}>;
  sendEvent?: (
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
  ) => Promise<string | {event_id?: string; eventId?: string}>;
  getRooms?: () => Array<{
    roomId?: unknown;
    getRoomId?: () => string | null;
    name?: unknown;
    getDefaultRoomName?: () => string | {name?: unknown} | null;
    currentState?: {
      getStateEvents?: (eventType: string, stateKey: string) => {
        getContent?: () => {topic?: unknown} | null;
      } | null;
    };
    isDirect?: unknown;
    getDMInviter?: () => string | null;
    getLastActiveTimestamp?: () => number;
    timeline?: unknown[];
  }>;
  off?: (eventName: string, handler: (...args: unknown[]) => void) => void;
  on?: (eventName: string, handler: (...args: unknown[]) => void) => void;
}

interface MatrixSyncDataShape {
  nextSyncToken?: string;
  next_batch?: string;
}

class MatrixClientWrapper {
  private client: MatrixSdkClient | null = null;
  private listeners = new Set<MatrixEventHandler>();
  private syncTokenListeners = new Set<(token: string) => void>();

  private emit(event: MatrixClientEvent): void {
    this.listeners.forEach(listener => {
      listener(event);
    });
  }

  subscribe(listener: MatrixEventHandler): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeSyncToken(listener: (token: string) => void): () => void {
    this.syncTokenListeners.add(listener);
    return () => {
      this.syncTokenListeners.delete(listener);
    };
  }

  private getAuthClient(): MatrixSdkClient & MatrixAuthClientShape {
    return this.getClient() as MatrixSdkClient & MatrixAuthClientShape;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  async connectToHomeserver(baseUrl: string): Promise<void> {
    const versionsUrl = `${baseUrl.replace(/\/$/, '')}/_matrix/client/versions`;

    try {
      const response = await fetch(versionsUrl, {method: 'GET'});

      if (!response.ok) {
        throw new Error(`Homeserver probe failed with status ${response.status}`);
      }
    } catch (error) {
      throw new SautiError(
        'MATRIX_HOMESERVER_UNREACHABLE',
        'Unable to connect to Matrix homeserver.',
        error,
      );
    }
  }

  private wireSdkEvents(client: MatrixSdkClient & MatrixAuthClientShape): void {
    if (!client.on) {
      return;
    }

    client.on('sync', (state: unknown, _prev: unknown, data: unknown) => {
      this.emit({
        type: 'syncStateChanged',
        state: typeof state === 'string' ? state : 'UNKNOWN',
      });

      const syncData = data as MatrixSyncDataShape | undefined;
      const token =
        typeof syncData?.nextSyncToken === 'string'
          ? syncData.nextSyncToken
          : typeof syncData?.next_batch === 'string'
            ? syncData.next_batch
            : null;

      if (token) {
        this.syncTokenListeners.forEach(listener => {
          listener(token);
        });
      }
    });

    client.on('Room.myMembership', (room: unknown, membership: unknown, previousMembership: unknown) => {
      const roomRecord = room as {
        roomId?: unknown;
        getRoomId?: () => string | null;
        name?: unknown;
        getDefaultRoomName?: () => string | {name?: unknown} | null;
        currentState?: {
          getStateEvents?: (eventType: string, stateKey: string) => {
            getContent?: () => {topic?: unknown} | null;
          } | null;
        };
        isDirect?: unknown;
        getDMInviter?: () => string | null;
      } | null;
      const roomId =
        typeof roomRecord?.roomId === 'string'
          ? roomRecord.roomId
          : typeof roomRecord?.getRoomId === 'function'
            ? roomRecord.getRoomId() ?? ''
            : '';

      const defaultRoomName =
        typeof roomRecord?.getDefaultRoomName === 'function'
          ? roomRecord.getDefaultRoomName()
          : null;
      const roomNameCandidate =
        typeof roomRecord?.name === 'string'
          ? roomRecord.name
          : typeof defaultRoomName === 'string'
            ? defaultRoomName
            : typeof defaultRoomName === 'object' &&
                defaultRoomName !== null &&
                typeof defaultRoomName.name === 'string'
              ? defaultRoomName.name
              : undefined;
      const roomName =
        typeof roomNameCandidate === 'string' && roomNameCandidate.trim().length > 0
          ? roomNameCandidate
          : undefined;

      const topicEvent = roomRecord?.currentState?.getStateEvents?.('m.room.topic', '');
      const topicContent = topicEvent?.getContent?.();
      const topic =
        typeof topicContent?.topic === 'string' && topicContent.topic.trim().length > 0
          ? topicContent.topic
          : undefined;

      const isDirect =
        typeof roomRecord?.isDirect === 'boolean'
          ? roomRecord.isDirect
          : typeof roomRecord?.getDMInviter === 'function'
            ? Boolean(roomRecord.getDMInviter())
            : undefined;

      if (!roomId || typeof membership !== 'string') {
        return;
      }

      this.emit({
        type: 'roomMembershipChanged',
        roomId,
        membership,
        previousMembership:
          typeof previousMembership === 'string' ? previousMembership : undefined,
        roomName,
        topic,
        isDirect,
      });
    });

    client.on('Room.timeline', (event: unknown, room: unknown, toStartOfTimeline: unknown) => {
      if (toStartOfTimeline === true) {
        return;
      }

      const eventRecord = event as {
        getType?: () => string;
        getContent?: () => {body?: unknown; msgtype?: unknown} | null;
        getRoomId?: () => string;
        getId?: () => string | null;
        getSender?: () => string | null;
        getTs?: () => number;
      };

      const roomRecord = room as {roomId?: unknown; getRoomId?: () => string | null} | null;
      const roomId =
        typeof roomRecord?.roomId === 'string'
          ? roomRecord.roomId
          : typeof roomRecord?.getRoomId === 'function'
            ? roomRecord.getRoomId() ?? eventRecord.getRoomId?.() ?? ''
            : eventRecord.getRoomId?.() ?? '';

      const eventType = eventRecord.getType?.();
      const content = eventRecord.getContent?.();
      const eventTimestamp = eventRecord.getTs?.() ?? Date.now();

      if (!roomId) {
        return;
      }

      if (eventType === 'm.room.name') {
        const roomName =
          content && typeof content.name === 'string' && content.name.trim().length > 0
            ? content.name
            : undefined;

        this.emit({
          type: 'roomStateChanged',
          roomId,
          roomName,
          timestamp: eventTimestamp,
        });
        return;
      }

      if (eventType === 'm.room.topic') {
        const topic =
          content && typeof content.topic === 'string' && content.topic.trim().length > 0
            ? content.topic
            : undefined;

        this.emit({
          type: 'roomStateChanged',
          roomId,
          topic,
          timestamp: eventTimestamp,
        });
        return;
      }

      if (eventType !== 'm.room.message') {
        return;
      }

      if (!content || typeof content.body !== 'string') {
        return;
      }

      const eventId = eventRecord.getId?.();
      const senderId = eventRecord.getSender?.();

      if (!roomId || !eventId || !senderId) {
        return;
      }

      this.emit({
        type: 'roomMessageReceived',
        roomId,
        eventId,
        senderId,
        body: content.body,
        msgType: typeof content.msgtype === 'string' ? content.msgtype : 'm.text',
        timestamp: eventTimestamp,
      });
    });
  }

  initialize(options: MatrixClientInitOptions): MatrixSdkClient {
    try {
      this.client = createClient({
        baseUrl: options.baseUrl,
        userId: options.userId,
        accessToken: options.accessToken,
        deviceId: options.deviceId,
        fetchFn: options.fetchFn,
      });

      this.wireSdkEvents(this.getAuthClient());

      return this.client;
    } catch (error) {
      throw new SautiError(
        'MATRIX_INIT_FAILED',
        'Failed to initialize Matrix client.',
        error,
      );
    }
  }

  getClient(): MatrixSdkClient {
    if (!this.client) {
      throw new SautiError(
        'MATRIX_MISSING_CLIENT',
        'Matrix client is not initialized.',
      );
    }

    return this.client;
  }

  async loginWithPassword(
    username: string,
    password: string,
  ): Promise<MatrixLoginResult> {
    try {
      const client = this.getAuthClient();

      if (!client.login) {
        throw new Error('Matrix SDK client missing login capability.');
      }

      const response = await client.login('m.login.password', {
        identifier: {
          type: 'm.id.user',
          user: username,
        },
        password,
      });

      const result: MatrixLoginResult = {
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id,
        refreshToken: response.refresh_token,
      };

      this.emit({type: 'authStateChanged', state: 'logged_in'});
      return result;
    } catch (error) {
      throw new SautiError('MATRIX_LOGIN_FAILED', 'Matrix login failed.', error);
    }
  }

  loginWithSso(options: MatrixSsoLoginOptions): {ssoUrl: string} {
    try {
      const client = this.getAuthClient();

      if (!client.getSsoLoginUrl) {
        throw new Error('Matrix SDK client missing getSsoLoginUrl capability.');
      }

      const ssoUrl = client.getSsoLoginUrl(
        options.redirectUrl,
        'sso',
        options.idpId,
      );

      return {ssoUrl};
    } catch (error) {
      throw new SautiError('MATRIX_LOGIN_FAILED', 'Matrix SSO login failed.', error);
    }
  }

  async createConversation(
    options: MatrixCreateConversationOptions,
  ): Promise<MatrixConversationResult> {
    try {
      const client = this.getAuthClient();
      if (!client.createRoom) {
        throw new Error('Matrix SDK client missing createRoom capability.');
      }

      const result = await client.createRoom({
        invite: [options.inviteeUserId],
        is_direct: true,
        name: options.name,
        topic: options.topic,
        preset: 'trusted_private_chat',
      });

      if (typeof result.room_id !== 'string') {
        throw new Error('Matrix SDK createRoom response missing room_id.');
      }

      return {roomId: result.room_id};
    } catch (error) {
      throw new SautiError(
        'MATRIX_ROOM_OPERATION_FAILED',
        'Matrix create conversation failed.',
        error,
      );
    }
  }

  async joinConversation(roomIdOrAlias: string): Promise<MatrixConversationResult> {
    try {
      const client = this.getAuthClient();
      if (!client.joinRoom) {
        throw new Error('Matrix SDK client missing joinRoom capability.');
      }

      const room = await client.joinRoom(roomIdOrAlias);
      const roomId =
        typeof room.roomId === 'string'
          ? room.roomId
          : typeof room.room_id === 'string'
            ? room.room_id
            : null;

      if (!roomId) {
        throw new Error('Matrix SDK joinRoom response missing room ID.');
      }

      return {roomId};
    } catch (error) {
      throw new SautiError(
        'MATRIX_ROOM_OPERATION_FAILED',
        'Matrix join conversation failed.',
        error,
      );
    }
  }

  async sendTextMessage(roomId: string, body: string): Promise<{eventId: string}> {
    try {
      const client = this.getAuthClient();
      if (!client.sendEvent) {
        throw new Error('Matrix SDK client missing sendEvent capability.');
      }

      const response = await client.sendEvent(roomId, 'm.room.message', {
        msgtype: 'm.text',
        body,
      });

      const eventId =
        typeof response === 'string'
          ? response
          : typeof response.event_id === 'string'
            ? response.event_id
            : typeof response.eventId === 'string'
              ? response.eventId
              : null;

      if (!eventId) {
        throw new Error('Matrix SDK sendEvent response missing event ID.');
      }

      return {eventId};
    } catch (error) {
      throw new SautiError(
        'MATRIX_ROOM_OPERATION_FAILED',
        'Matrix send message failed.',
        error,
      );
    }
  }

  async listRoomSnapshots(): Promise<MatrixRoomSnapshot[]> {
    try {
      const client = this.getAuthClient();
      const rooms = typeof client.getRooms === 'function' ? client.getRooms() : [];

      return rooms
        .map(room => {
          const roomId =
            typeof room.roomId === 'string'
              ? room.roomId
              : typeof room.getRoomId === 'function'
                ? room.getRoomId() ?? ''
                : '';

          if (!roomId) {
            return null;
          }

          const defaultRoomName =
            typeof room.getDefaultRoomName === 'function'
              ? room.getDefaultRoomName()
              : null;
          const roomNameCandidate =
            typeof room.name === 'string'
              ? room.name
              : typeof defaultRoomName === 'string'
                ? defaultRoomName
                : typeof defaultRoomName === 'object' &&
                    defaultRoomName !== null &&
                    typeof defaultRoomName.name === 'string'
                  ? defaultRoomName.name
                  : undefined;
          const roomName =
            typeof roomNameCandidate === 'string' && roomNameCandidate.trim().length > 0
              ? roomNameCandidate
              : undefined;

          const topicEvent = room.currentState?.getStateEvents?.('m.room.topic', '');
          const topicContent = topicEvent?.getContent?.();
          const topic =
            typeof topicContent?.topic === 'string' && topicContent.topic.trim().length > 0
              ? topicContent.topic
              : undefined;

          const isDirect =
            typeof room.isDirect === 'boolean'
              ? room.isDirect
              : typeof room.getDMInviter === 'function'
                ? Boolean(room.getDMInviter())
                : undefined;

          const lastEventAt =
            typeof room.getLastActiveTimestamp === 'function'
              ? room.getLastActiveTimestamp()
              : undefined;

          return {
            roomId,
            roomName,
            topic,
            isDirect,
            lastEventAt: typeof lastEventAt === 'number' ? lastEventAt : undefined,
          };
        })
        .filter((value): value is MatrixRoomSnapshot => value !== null);
    } catch (error) {
      throw new SautiError(
        'MATRIX_ROOM_OPERATION_FAILED',
        'Matrix room snapshot listing failed.',
        error,
      );
    }
  }

  async logout(): Promise<void> {
    try {
      const client = this.getAuthClient();

      if (client.logout) {
        await client.logout();
      }

      if (client.stopClient) {
        client.stopClient();
      }

      this.emit({type: 'authStateChanged', state: 'logged_out'});
    } catch (error) {
      throw new SautiError('MATRIX_LOGOUT_FAILED', 'Matrix logout failed.', error);
    }
  }

  async refreshAccessToken(
    baseUrl: string,
    refreshToken: string,
  ): Promise<string> {
    const refreshUrl = `${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/refresh`;

    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refresh_token: refreshToken}),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const payloadUnknown: unknown = await response.json();

      if (!payloadUnknown || typeof payloadUnknown !== 'object') {
        throw new Error('Refresh response payload is invalid.');
      }

      const payload = payloadUnknown as {access_token?: unknown};
      if (typeof payload.access_token !== 'string') {
        throw new Error('Refresh response missing access_token.');
      }

      return payload.access_token;
    } catch (error) {
      throw new SautiError(
        'MATRIX_TOKEN_REFRESH_FAILED',
        'Matrix access token refresh failed.',
        error,
      );
    }
  }

  async reconnectAfterNetworkLoss(
    baseUrl: string,
    options: MatrixReconnectOptions = {},
  ): Promise<void> {
    const maxAttempts = options.maxAttempts ?? 5;
    const initialDelayMs = options.initialDelayMs ?? 500;
    const backoffMultiplier = options.backoffMultiplier ?? 2;

    let delayMs = initialDelayMs;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        this.emit({type: 'connectionStateChanged', state: 'reconnecting'});
        await this.connectToHomeserver(baseUrl);

        const client = this.getAuthClient();
        if (client.startClient) {
          client.startClient();
        }

        this.emit({type: 'connectionStateChanged', state: 'connected'});
        return;
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        await this.wait(delayMs);
        delayMs *= backoffMultiplier;
      }
    }

    this.emit({type: 'connectionStateChanged', state: 'disconnected'});
    throw new SautiError(
      'MATRIX_RECONNECT_FAILED',
      'Matrix reconnect attempts exhausted.',
      lastError,
    );
  }

  resetForTests(): void {
    this.client = null;
    this.listeners.clear();
    this.syncTokenListeners.clear();
  }
}

export const matrixClient = new MatrixClientWrapper();
