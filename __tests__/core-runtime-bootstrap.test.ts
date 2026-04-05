jest.mock('../src/core/runtime', () => ({
  hasCoreAppRuntime: jest.fn(),
  getCoreAppRuntime: jest.fn(),
  initializeCoreAppRuntime: jest.fn(),
  resetCoreAppRuntimeForTests: jest.fn(),
}));

import {
  getCoreAppRuntime,
  hasCoreAppRuntime,
  initializeCoreAppRuntime,
  resetCoreAppRuntimeForTests,
} from '../src/core/runtime';
import {
  ensureCoreRuntimeInitialized,
  getAppBootstrapSnapshot,
  logoutCoreRuntime,
  resetAppBootstrapForTests,
  startCoreRuntime,
  stopCoreRuntime,
  subscribeAppBootstrap,
} from '../src/app';

describe('CoreRuntimeBootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAppBootstrapForTests();
  });

  it('returns existing runtime when already initialized', () => {
    const runtime = {start: jest.fn(), stop: jest.fn()};
    (hasCoreAppRuntime as jest.Mock).mockReturnValue(true);
    (getCoreAppRuntime as jest.Mock).mockReturnValue(runtime);

    const resolved = ensureCoreRuntimeInitialized();

    expect(resolved).toBe(runtime);
    expect(initializeCoreAppRuntime).not.toHaveBeenCalled();
  });

  it('publishes starting and ready status on successful start', async () => {
    const runtime = {
      start: jest.fn(async () => ({
        status: 'ready',
        boot: {
          runtime: {},
          homeserverDomain: 'example.org',
        },
      })),
      recover: jest.fn(async () => undefined),
      logout: jest.fn(async () => undefined),
      stop: jest.fn(),
    };

    (hasCoreAppRuntime as jest.Mock).mockReturnValue(false);
    (initializeCoreAppRuntime as jest.Mock).mockReturnValue(runtime);

    const seen: string[] = [];
    const unsubscribe = subscribeAppBootstrap(snapshot => {
      seen.push(snapshot.status);
    });

    await startCoreRuntime({
      tokenStore: {
        getSyncToken: jest.fn(),
        saveSyncToken: jest.fn(),
      },
    });

    unsubscribe();

    expect(seen).toEqual(['idle', 'starting', 'ready']);
    expect(getAppBootstrapSnapshot()).toEqual({status: 'ready'});
  });

  it('publishes signed_out and idle during logout/stop flows', async () => {
    const runtime = {
      start: jest.fn(async () => ({
        status: 'signed_out',
        reason: 'session_missing',
      })),
      recover: jest.fn(async () => undefined),
      logout: jest.fn(async () => undefined),
      stop: jest.fn(),
    };

    (hasCoreAppRuntime as jest.Mock)
      .mockReturnValueOnce(false)
      .mockReturnValue(true)
      .mockReturnValue(true);
    (initializeCoreAppRuntime as jest.Mock).mockReturnValue(runtime);
    (getCoreAppRuntime as jest.Mock).mockReturnValue(runtime);

    await startCoreRuntime({
      tokenStore: {
        getSyncToken: jest.fn(),
        saveSyncToken: jest.fn(),
      },
    });

    expect(getAppBootstrapSnapshot()).toEqual({
      status: 'signed_out',
      reason: 'session_missing',
    });

    await logoutCoreRuntime();
    expect(getAppBootstrapSnapshot()).toEqual({status: 'signed_out'});

    stopCoreRuntime();
    expect(runtime.stop).toHaveBeenCalledTimes(1);
    expect(getAppBootstrapSnapshot()).toEqual({status: 'idle'});
  });

  it('resets bootstrap state and delegates core runtime reset helper', () => {
    resetAppBootstrapForTests();

    expect(getAppBootstrapSnapshot()).toEqual({status: 'idle'});
    expect(resetCoreAppRuntimeForTests).toHaveBeenCalled();
  });
});
