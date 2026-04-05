jest.mock('../src/app/bootstrap', () => ({
  createAppStartupOrchestrator: jest.fn(),
}));

import {createAppStartupOrchestrator} from '../src/app/bootstrap';
import {
  bootAppRuntime,
  getAppStartupSnapshot,
  resetAppStartupRuntimeForTests,
  stopAppRuntime,
  subscribeAppStartup,
} from '../src/app';

describe('AppStartupRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAppStartupRuntimeForTests();
  });

  it('creates orchestrator lazily and reuses singleton for boot and snapshot operations', async () => {
    const initializeAndResume = jest.fn(async () => undefined);

    (createAppStartupOrchestrator as jest.Mock).mockReturnValue({
      initializeAndResume,
      subscribe: jest.fn(() => () => undefined),
      getSnapshot: jest.fn(() => ({status: 'idle'})),
      stop: jest.fn(),
      reset: jest.fn(),
    });

    await bootAppRuntime();
    await bootAppRuntime();
    getAppStartupSnapshot();

    expect(createAppStartupOrchestrator).toHaveBeenCalledTimes(1);
    expect(initializeAndResume).toHaveBeenCalledTimes(2);
  });

  it('delegates subscribe and stop to underlying orchestrator', () => {
    const unsubscribe = jest.fn();
    const subscribe = jest.fn(() => unsubscribe);
    const stop = jest.fn();

    (createAppStartupOrchestrator as jest.Mock).mockReturnValue({
      initializeAndResume: jest.fn(async () => undefined),
      subscribe,
      getSnapshot: jest.fn(() => ({status: 'idle'})),
      stop,
      reset: jest.fn(),
    });

    const listener = jest.fn();
    const un = subscribeAppStartup(listener);

    stopAppRuntime();
    un();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('resets existing singleton and allows fresh orchestrator creation', async () => {
    const firstReset = jest.fn();

    (createAppStartupOrchestrator as jest.Mock)
      .mockReturnValueOnce({
        initializeAndResume: jest.fn(async () => undefined),
        subscribe: jest.fn(() => () => undefined),
        getSnapshot: jest.fn(() => ({status: 'idle'})),
        stop: jest.fn(),
        reset: firstReset,
      })
      .mockReturnValueOnce({
        initializeAndResume: jest.fn(async () => undefined),
        subscribe: jest.fn(() => () => undefined),
        getSnapshot: jest.fn(() => ({status: 'idle'})),
        stop: jest.fn(),
        reset: jest.fn(),
      });

    await bootAppRuntime();
    resetAppStartupRuntimeForTests();
    await bootAppRuntime();

    expect(firstReset).toHaveBeenCalledTimes(1);
    expect(createAppStartupOrchestrator).toHaveBeenCalledTimes(2);
  });
});
