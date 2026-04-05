jest.mock('../src/core/runtime/createCoreAppRuntime', () => ({
  createCoreAppRuntime: jest.fn(),
}));

import {createCoreAppRuntime} from '../src/core/runtime/createCoreAppRuntime';
import {
  getCoreAppRuntime,
  getCoreDatabase,
  getCoreMessagingRuntime,
  hasCoreAppRuntime,
  initializeCoreAppRuntime,
  resetCoreAppRuntimeForTests,
} from '../src/core/runtime';

describe('CoreAppRuntimeRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCoreAppRuntimeForTests();
  });

  it('initializes once and exposes runtime, messaging, and database accessors', () => {
    const runtime = {
      database: {db: 'one'},
      messaging: {dispatch: {}},
      stop: jest.fn(),
    };

    (createCoreAppRuntime as jest.Mock).mockReturnValue(runtime);

    expect(hasCoreAppRuntime()).toBe(false);

    const initialized = initializeCoreAppRuntime({
      tokenStore: {
        getSyncToken: jest.fn(),
        saveSyncToken: jest.fn(),
      },
    } as never);

    expect(createCoreAppRuntime).toHaveBeenCalledTimes(1);
    expect(initialized).toBe(runtime);
    expect(hasCoreAppRuntime()).toBe(true);
    expect(getCoreAppRuntime()).toBe(runtime);
    expect(getCoreMessagingRuntime()).toBe(runtime.messaging);
    expect(getCoreDatabase()).toBe(runtime.database);
  });

  it('throws on second initialization unless replaceExisting is true', () => {
    const firstRuntime = {
      database: {db: 'one'},
      messaging: {},
      stop: jest.fn(),
    };
    const secondRuntime = {
      database: {db: 'two'},
      messaging: {},
      stop: jest.fn(),
    };

    (createCoreAppRuntime as jest.Mock)
      .mockReturnValueOnce(firstRuntime)
      .mockReturnValueOnce(secondRuntime);

    initializeCoreAppRuntime({
      tokenStore: {
        getSyncToken: jest.fn(),
        saveSyncToken: jest.fn(),
      },
    } as never);

    expect(() =>
      initializeCoreAppRuntime({
        tokenStore: {
          getSyncToken: jest.fn(),
          saveSyncToken: jest.fn(),
        },
      } as never),
    ).toThrow('Core app runtime is already initialized.');

    const replaced = initializeCoreAppRuntime(
      {
        tokenStore: {
          getSyncToken: jest.fn(),
          saveSyncToken: jest.fn(),
        },
      } as never,
      {replaceExisting: true},
    );

    expect(firstRuntime.stop).toHaveBeenCalledTimes(1);
    expect(replaced).toBe(secondRuntime);
  });

  it('throws when accessing runtime before initialization', () => {
    expect(() => getCoreAppRuntime()).toThrow(
      'Core app runtime has not been initialized.',
    );
  });

  it('reset stops existing runtime and clears singleton', () => {
    const runtime = {
      database: {db: 'one'},
      messaging: {},
      stop: jest.fn(),
    };

    (createCoreAppRuntime as jest.Mock).mockReturnValue(runtime);

    initializeCoreAppRuntime({
      tokenStore: {
        getSyncToken: jest.fn(),
        saveSyncToken: jest.fn(),
      },
    } as never);

    resetCoreAppRuntimeForTests();

    expect(runtime.stop).toHaveBeenCalledTimes(1);
    expect(hasCoreAppRuntime()).toBe(false);
  });
});
