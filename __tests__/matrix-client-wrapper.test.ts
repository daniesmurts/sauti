import {createClient} from 'matrix-js-sdk';

import {matrixClient} from '../src/core/matrix/MatrixClient';

jest.mock('matrix-js-sdk', () => ({
  createClient: jest.fn(),
}));

describe('MatrixClientWrapper advanced behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    matrixClient.resetForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
    matrixClient.resetForTests();
  });

  it('emits typed auth event on successful password login', async () => {
    const loginMock = jest.fn().mockResolvedValue({
      access_token: 'access-123',
      user_id: '@alice:localhost',
      device_id: 'DEVICE123',
      refresh_token: 'refresh-abc',
    });

    (createClient as jest.Mock).mockReturnValue({
      login: loginMock,
      on: jest.fn(),
      startClient: jest.fn(),
      stopClient: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const seenStates: string[] = [];
    const unsubscribe = matrixClient.subscribe(event => {
      if (event.type === 'authStateChanged') {
        seenStates.push(event.state);
      }
    });

    const result = await matrixClient.loginWithPassword('alice', 'secret');
    unsubscribe();

    expect(result.accessToken).toBe('access-123');
    expect(result.userId).toBe('@alice:localhost');
    expect(seenStates).toEqual(['logged_in']);
  });

  it('rethrows failed login as a typed SautiError', async () => {
    (createClient as jest.Mock).mockReturnValue({
      login: jest.fn().mockRejectedValue(new Error('boom')),
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    await expect(matrixClient.loginWithPassword('alice', 'secret')).rejects.toMatchObject({
      name: 'SautiError',
      code: 'MATRIX_LOGIN_FAILED',
    });
  });

  it('reconnects with exponential backoff and emits connection states', async () => {
    const startClientMock = jest.fn();

    (createClient as jest.Mock).mockReturnValue({
      on: jest.fn(),
      startClient: startClientMock,
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const states: string[] = [];
    matrixClient.subscribe(event => {
      if (event.type === 'connectionStateChanged') {
        states.push(event.state);
      }
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ok: false, status: 500} as Response)
      .mockResolvedValueOnce({ok: true, status: 200} as Response);

    const reconnectPromise = matrixClient.reconnectAfterNetworkLoss(
      'https://matrix.example.org',
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      },
    );

    await Promise.resolve();
    await jest.runOnlyPendingTimersAsync();
    await reconnectPromise;

    expect(startClientMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(states).toEqual(['reconnecting', 'reconnecting', 'connected']);

    fetchMock.mockRestore();
  });

  it('throws typed reconnect error when attempts are exhausted', async () => {
    (createClient as jest.Mock).mockReturnValue({
      on: jest.fn(),
      startClient: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ok: false, status: 500} as Response);

    await expect(
      matrixClient.reconnectAfterNetworkLoss('https://matrix.example.org', {
        maxAttempts: 1,
      }),
    ).rejects.toMatchObject({code: 'MATRIX_RECONNECT_FAILED'});

    fetchMock.mockRestore();
  });

  it('returns SSO login URL using SDK helper', () => {
    const getSsoLoginUrl = jest
      .fn()
      .mockReturnValue('https://matrix.example.org/sso/redirect');

    (createClient as jest.Mock).mockReturnValue({
      getSsoLoginUrl,
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const result = matrixClient.loginWithSso({
      redirectUrl: 'sauti://auth/callback',
      idpId: 'oidc-main',
    });

    expect(getSsoLoginUrl).toHaveBeenCalledWith(
      'sauti://auth/callback',
      'sso',
      'oidc-main',
    );
    expect(result).toEqual({
      ssoUrl: 'https://matrix.example.org/sso/redirect',
    });
  });

  it('creates conversation with direct-room settings and typed result', async () => {
    const createRoom = jest.fn().mockResolvedValue({
      room_id: '!room123:example.org',
    });

    (createClient as jest.Mock).mockReturnValue({
      createRoom,
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const room = await matrixClient.createConversation({
      inviteeUserId: '@bob:example.org',
      name: 'Bob',
      topic: 'Direct chat',
    });

    expect(createRoom).toHaveBeenCalledWith({
      invite: ['@bob:example.org'],
      is_direct: true,
      name: 'Bob',
      topic: 'Direct chat',
      preset: 'trusted_private_chat',
    });
    expect(room).toEqual({roomId: '!room123:example.org'});
  });

  it('joins conversation and returns normalized room ID', async () => {
    const joinRoom = jest.fn().mockResolvedValue({
      roomId: '!joined:example.org',
    });

    (createClient as jest.Mock).mockReturnValue({
      joinRoom,
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const room = await matrixClient.joinConversation('#general:example.org');

    expect(joinRoom).toHaveBeenCalledWith('#general:example.org');
    expect(room).toEqual({roomId: '!joined:example.org'});
  });

  it('rethrows room operations as typed room-operation errors', async () => {
    (createClient as jest.Mock).mockReturnValue({
      createRoom: jest.fn().mockRejectedValue(new Error('cannot create room')),
      joinRoom: jest.fn().mockRejectedValue(new Error('cannot join room')),
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    await expect(
      matrixClient.createConversation({
        inviteeUserId: '@bob:example.org',
      }),
    ).rejects.toMatchObject({
      code: 'MATRIX_ROOM_OPERATION_FAILED',
      name: 'SautiError',
    });

    await expect(matrixClient.joinConversation('#general:example.org')).rejects.toMatchObject({
      code: 'MATRIX_ROOM_OPERATION_FAILED',
      name: 'SautiError',
    });
  });

  it('sends text message and returns normalized event id', async () => {
    const sendEvent = jest.fn().mockResolvedValue({
      event_id: '$event-123',
    });

    (createClient as jest.Mock).mockReturnValue({
      sendEvent,
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const sent = await matrixClient.sendTextMessage('!room:example.org', 'hello');

    expect(sendEvent).toHaveBeenCalledWith('!room:example.org', 'm.room.message', {
      msgtype: 'm.text',
      body: 'hello',
    });
    expect(sent).toEqual({eventId: '$event-123'});
  });

  it('rethrows send failures as typed room-operation errors', async () => {
    (createClient as jest.Mock).mockReturnValue({
      sendEvent: jest.fn().mockRejectedValue(new Error('send failed')),
      on: jest.fn(),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    await expect(
      matrixClient.sendTextMessage('!room:example.org', 'hello'),
    ).rejects.toMatchObject({
      code: 'MATRIX_ROOM_OPERATION_FAILED',
      name: 'SautiError',
    });
  });

  it('maps SDK timeline and membership events to typed wrapper events', () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};

    (createClient as jest.Mock).mockReturnValue({
      on: jest.fn((eventName: string, handler: (...args: unknown[]) => void) => {
        handlers[eventName] = handler;
      }),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const events: string[] = [];
    matrixClient.subscribe(event => {
      events.push(event.type);
    });

    handlers['Room.myMembership']?.(
      {roomId: '!room:example.org'},
      'join',
      'invite',
    );

    handlers['Room.timeline']?.(
      {
        getType: () => 'm.room.message',
        getContent: () => ({body: 'hello', msgtype: 'm.text'}),
        getId: () => '$event123',
        getSender: () => '@bob:example.org',
        getTs: () => 100,
      },
      {roomId: '!room:example.org'},
      false,
    );

    handlers['Room.timeline']?.(
      {
        getType: () => 'm.room.name',
        getContent: () => ({name: 'Family Group'}),
        getId: () => '$state1',
        getTs: () => 101,
      },
      {roomId: '!room:example.org'},
      false,
    );

    handlers['Room.timeline']?.(
      {
        getType: () => 'm.room.topic',
        getContent: () => ({topic: 'Campus updates'}),
        getId: () => '$state2',
        getTs: () => 102,
      },
      {roomId: '!room:example.org'},
      false,
    );

    expect(events).toContain('roomMembershipChanged');
    expect(events).toContain('roomMessageReceived');
    expect(events).toContain('roomStateChanged');
  });

  it('forwards sync tokens from SDK sync events to token subscribers', () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};

    (createClient as jest.Mock).mockReturnValue({
      on: jest.fn((eventName: string, handler: (...args: unknown[]) => void) => {
        handlers[eventName] = handler;
      }),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const tokens: string[] = [];
    matrixClient.subscribeSyncToken(token => {
      tokens.push(token);
    });

    handlers.sync?.('SYNCING', 'PREPARED', {nextSyncToken: 's123'});

    expect(tokens).toEqual(['s123']);
  });

  it('lists room snapshots with canonical metadata from SDK rooms', async () => {
    const getStateEvents = jest.fn().mockReturnValue({
      getContent: () => ({topic: 'Campus updates'}),
    });

    (createClient as jest.Mock).mockReturnValue({
      on: jest.fn(),
      getRooms: jest.fn().mockReturnValue([
        {
          roomId: '!family:example.org',
          name: 'Family Group',
          currentState: {getStateEvents},
          isDirect: false,
          getLastActiveTimestamp: () => 900,
        },
      ]),
    });

    matrixClient.initialize({
      baseUrl: 'https://matrix.example.org',
      userId: '@alice:localhost',
      accessToken: 'token',
    });

    const rooms = await matrixClient.listRoomSnapshots();

    expect(rooms).toEqual([
      {
        roomId: '!family:example.org',
        roomName: 'Family Group',
        topic: 'Campus updates',
        isDirect: false,
        lastEventAt: 900,
      },
    ]);
  });
});
