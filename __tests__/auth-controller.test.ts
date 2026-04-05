import {createAuthController} from '../src/modules/auth';

describe('createAuthController', () => {
  it('returns current snapshot and emits updates through subscribe', async () => {
    const state = {
      status: 'idle',
      reason: undefined,
      errorMessage: undefined,
      userId: undefined,
      subscriptionPlan: undefined,
      subscriptionWarning: undefined,
      registerAndBootstrap: jest.fn(async () => undefined),
      resumeFromStoredSession: jest.fn(async () => undefined),
      reset: jest.fn(),
    };

    let subscriber: ((nextState: typeof state, prevState: typeof state) => void) | null =
      null;

    const store = {
      getState: () => state,
      subscribe: (listener: (nextState: typeof state, prevState: typeof state) => void) => {
        subscriber = listener;
        return () => {
          subscriber = null;
        };
      },
    };

    const controller = createAuthController({store: store as never});

    expect(controller.getSnapshot()).toEqual({
      status: 'idle',
      reason: undefined,
      errorMessage: undefined,
      userId: undefined,
      subscriptionPlan: undefined,
      subscriptionWarning: undefined,
    });

    const seen: string[] = [];
    const unsubscribe = controller.subscribe(snapshot => {
      seen.push(snapshot.status);
    });

    state.status = 'resuming';
    subscriber?.(state, state);

    state.status = 'ready';
    state.userId = '@alice:example.org';
    subscriber?.(state, state);

    unsubscribe();

    expect(seen).toEqual(['idle', 'resuming', 'ready']);
  });

  it('delegates actions to underlying auth store actions', async () => {
    const registerAndBootstrap = jest.fn(async () => undefined);
    const resumeFromStoredSession = jest.fn(async () => undefined);
    const reset = jest.fn();

    const state = {
      status: 'idle',
      reason: undefined,
      errorMessage: undefined,
      userId: undefined,
      subscriptionPlan: undefined,
      subscriptionWarning: undefined,
      registerAndBootstrap,
      resumeFromStoredSession,
      reset,
    };

    const controller = createAuthController({
      store: {
        getState: () => state,
        subscribe: () => () => undefined,
      } as never,
    });

    await controller.registerAndBootstrap({
      phoneNumber: '+2348000000000',
      otpCode: '123456',
      password: 'strong-password',
    });

    await controller.resumeFromStoredSession();
    controller.reset();

    expect(registerAndBootstrap).toHaveBeenCalledTimes(1);
    expect(resumeFromStoredSession).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
