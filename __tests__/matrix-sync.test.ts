import {MatrixSync} from '../src/core/matrix/MatrixSync';

describe('MatrixSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts sync using last persisted sync token', async () => {
    const startClient = jest.fn();
    const stopClient = jest.fn();

    const sync = new MatrixSync(
      {startClient, stopClient},
      {
        getSyncToken: jest.fn().mockResolvedValue('s123'),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
    );

    await sync.start();

    expect(startClient).toHaveBeenCalledWith({
      initialSyncLimit: 20,
      since: 's123',
    });
    expect(sync.getState()).toBe('running');
  });

  it('debounces token persistence and writes latest token once', async () => {
    const saveSyncToken = jest.fn().mockResolvedValue(undefined);

    const sync = new MatrixSync(
      {startClient: jest.fn(), stopClient: jest.fn()},
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken,
      },
      {debounceMs: 200},
    );

    sync.onSyncTokenUpdated('s1');
    sync.onSyncTokenUpdated('s2');
    sync.onSyncTokenUpdated('s3');

    await jest.advanceTimersByTimeAsync(199);
    expect(saveSyncToken).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await Promise.resolve();

    expect(saveSyncToken).toHaveBeenCalledTimes(1);
    expect(saveSyncToken).toHaveBeenCalledWith('s3');
  });

  it('pauses sync after app is backgrounded for over 10 minutes', async () => {
    const startClient = jest.fn();
    const stopClient = jest.fn();
    let nowMs = 0;

    const sync = new MatrixSync(
      {startClient, stopClient},
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        now: () => nowMs,
        backgroundPauseThresholdMs: 10 * 60 * 1000,
      },
    );

    await sync.start();
    expect(sync.getState()).toBe('running');

    sync.onAppStateChanged('background');
    nowMs = 10 * 60 * 1000 + 1;
    sync.onAppStateChanged('active');

    expect(stopClient).toHaveBeenCalledTimes(1);
    expect(sync.getState()).toBe('paused');
  });

  it('subscribes to sync-token source and persists incoming token updates', async () => {
    const saveSyncToken = jest.fn().mockResolvedValue(undefined);
    let sourceListener: ((token: string) => void) | null = null;

    const sync = new MatrixSync(
      {
        startClient: jest.fn(),
        stopClient: jest.fn(),
      },
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken,
      },
      {
        debounceMs: 200,
        tokenSource: {
          subscribe: listener => {
            sourceListener = listener;
            return () => {
              sourceListener = null;
            };
          },
        },
      },
    );

    await sync.start();

    sourceListener?.('s-next');
    await jest.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(saveSyncToken).toHaveBeenCalledWith('s-next');
  });
});
