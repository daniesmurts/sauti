import {
  PushNotificationService,
  type PushMessagePayload,
  type PushMessagingAdapter,
} from '../src/core/notifications';

function makeAdapter(
  overrides: Partial<PushMessagingAdapter> = {},
): PushMessagingAdapter {
  return {
    requestPermission: async () => 1,
    getToken: async () => 'token-123',
    onMessage: () => () => undefined,
    setBackgroundMessageHandler: () => undefined,
    getInitialNotification: async () => null,
    onNotificationOpenedApp: () => () => undefined,
    ...overrides,
  };
}

describe('PushNotificationService', () => {
  it('returns token when permission is granted', async () => {
    const service = new PushNotificationService(makeAdapter());
    await expect(service.initialize()).resolves.toEqual({
      token: 'token-123',
      permissionGranted: true,
    });
  });

  it('returns null token when permission is denied', async () => {
    const service = new PushNotificationService(
      makeAdapter({requestPermission: async () => 0}),
    );
    await expect(service.initialize()).resolves.toEqual({
      token: null,
      permissionGranted: false,
    });
  });

  it('subscribes and unsubscribes foreground messages', () => {
    const unsubscribe = jest.fn();
    const onMessage = jest.fn(() => unsubscribe);
    const service = new PushNotificationService(makeAdapter({onMessage}));
    const listener = (_payload: PushMessagePayload) => undefined;
    const dispose = service.subscribeForegroundMessages(listener);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(listener);

    dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('registers a background handler when adapter exists', async () => {
    const setBackgroundMessageHandler = jest.fn();
    const service = new PushNotificationService(
      makeAdapter({setBackgroundMessageHandler}),
    );
    const handler = async () => undefined;
    service.registerBackgroundHandler(handler);

    expect(setBackgroundMessageHandler).toHaveBeenCalledTimes(1);
    expect(setBackgroundMessageHandler).toHaveBeenCalledWith(handler);
  });

  it('is safely no-op when adapter is unavailable', async () => {
    const service = new PushNotificationService(null);

    await expect(service.initialize()).resolves.toEqual({
      token: null,
      permissionGranted: false,
    });

    const dispose = service.subscribeForegroundMessages(() => undefined);
    expect(() => dispose()).not.toThrow();

    expect(() => {
      service.registerBackgroundHandler(async () => undefined);
    }).not.toThrow();

    await expect(service.getInitialNotificationRoomId()).resolves.toBeNull();

    const unsub = service.subscribeNotificationOpen(() => undefined);
    expect(() => unsub()).not.toThrow();
  });

  describe('getInitialNotificationRoomId', () => {
    it('returns null when initial notification is absent', async () => {
      const service = new PushNotificationService(
        makeAdapter({getInitialNotification: async () => null}),
      );
      await expect(service.getInitialNotificationRoomId()).resolves.toBeNull();
    });

    it('extracts room_id from top-level payload field', async () => {
      const service = new PushNotificationService(
        makeAdapter({
          getInitialNotification: async () => ({'room_id': '!abc:example.com'}),
        }),
      );
      await expect(service.getInitialNotificationRoomId()).resolves.toBe(
        '!abc:example.com',
      );
    });

    it('extracts room_id from nested data field', async () => {
      const service = new PushNotificationService(
        makeAdapter({
          getInitialNotification: async () => ({
            data: {'room_id': '!xyz:matrix.org'},
          }),
        }),
      );
      await expect(service.getInitialNotificationRoomId()).resolves.toBe(
        '!xyz:matrix.org',
      );
    });

    it('returns null when payload contains no room_id', async () => {
      const service = new PushNotificationService(
        makeAdapter({
          getInitialNotification: async () => ({type: 'other'}),
        }),
      );
      await expect(service.getInitialNotificationRoomId()).resolves.toBeNull();
    });

    it('returns null when getInitialNotification throws', async () => {
      const service = new PushNotificationService(
        makeAdapter({
          getInitialNotification: async () => {
            throw new Error('unavailable');
          },
        }),
      );
      await expect(service.getInitialNotificationRoomId()).resolves.toBeNull();
    });
  });

  describe('subscribeNotificationOpen', () => {
    it('calls listener with room_id when notification is opened', () => {
      const delivered: string[] = [];
      let capturedListener: ((payload: PushMessagePayload) => void) | null = null;

      const service = new PushNotificationService(
        makeAdapter({
          onNotificationOpenedApp: listener => {
            capturedListener = listener;
            return () => undefined;
          },
        }),
      );

      service.subscribeNotificationOpen(roomId => delivered.push(roomId));

      capturedListener?.({'room_id': '!room1:example.com'});
      expect(delivered).toEqual(['!room1:example.com']);
    });

    it('ignores payloads without a room_id', () => {
      const delivered: string[] = [];
      let capturedListener: ((payload: PushMessagePayload) => void) | null = null;

      const service = new PushNotificationService(
        makeAdapter({
          onNotificationOpenedApp: listener => {
            capturedListener = listener;
            return () => undefined;
          },
        }),
      );

      service.subscribeNotificationOpen(roomId => delivered.push(roomId));

      capturedListener?.({type: 'other'});
      expect(delivered).toHaveLength(0);
    });

    it('extracts room_id from nested data field on open', () => {
      const delivered: string[] = [];
      let capturedListener: ((payload: PushMessagePayload) => void) | null = null;

      const service = new PushNotificationService(
        makeAdapter({
          onNotificationOpenedApp: listener => {
            capturedListener = listener;
            return () => undefined;
          },
        }),
      );

      service.subscribeNotificationOpen(roomId => delivered.push(roomId));

      capturedListener?.({data: {'room_id': '!nested:matrix.org'}});
      expect(delivered).toEqual(['!nested:matrix.org']);
    });

    it('returns an unsubscribe function that disconnects the listener', () => {
      const delivered: string[] = [];
      const platformUnsub = jest.fn();
      let capturedListener: ((payload: PushMessagePayload) => void) | null = null;

      const service = new PushNotificationService(
        makeAdapter({
          onNotificationOpenedApp: listener => {
            capturedListener = listener;
            return platformUnsub;
          },
        }),
      );

      const unsub = service.subscribeNotificationOpen(roomId =>
        delivered.push(roomId),
      );
      unsub();
      expect(platformUnsub).toHaveBeenCalledTimes(1);

      capturedListener?.({'room_id': '!room2:example.com'});
      expect(delivered).toHaveLength(0);
    });
  });
});
