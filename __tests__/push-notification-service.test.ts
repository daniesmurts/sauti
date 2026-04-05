import {
  PushNotificationService,
  type PushMessagePayload,
  type PushMessagingAdapter,
} from '../src/core/notifications';

describe('PushNotificationService', () => {
  it('returns token when permission is granted', async () => {
    const adapter: PushMessagingAdapter = {
      requestPermission: async () => 1,
      getToken: async () => 'token-123',
      onMessage: () => () => undefined,
      setBackgroundMessageHandler: () => undefined,
    };

    const service = new PushNotificationService(adapter);
    await expect(service.initialize()).resolves.toEqual({
      token: 'token-123',
      permissionGranted: true,
    });
  });

  it('returns null token when permission is denied', async () => {
    const adapter: PushMessagingAdapter = {
      requestPermission: async () => 0,
      getToken: async () => 'token-123',
      onMessage: () => () => undefined,
      setBackgroundMessageHandler: () => undefined,
    };

    const service = new PushNotificationService(adapter);
    await expect(service.initialize()).resolves.toEqual({
      token: null,
      permissionGranted: false,
    });
  });

  it('subscribes and unsubscribes foreground messages', () => {
    const unsubscribe = jest.fn();
    const onMessage = jest.fn(() => unsubscribe);

    const adapter: PushMessagingAdapter = {
      requestPermission: async () => 1,
      getToken: async () => 'token-123',
      onMessage,
      setBackgroundMessageHandler: () => undefined,
    };

    const service = new PushNotificationService(adapter);
    const listener = (_payload: PushMessagePayload) => undefined;
    const dispose = service.subscribeForegroundMessages(listener);

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(listener);

    dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('registers a background handler when adapter exists', async () => {
    const setBackgroundMessageHandler = jest.fn();
    const adapter: PushMessagingAdapter = {
      requestPermission: async () => 1,
      getToken: async () => 'token-123',
      onMessage: () => () => undefined,
      setBackgroundMessageHandler,
    };

    const service = new PushNotificationService(adapter);
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
  });
});
