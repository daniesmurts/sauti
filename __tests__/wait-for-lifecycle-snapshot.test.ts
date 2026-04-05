import {
  MatrixLifecycleSnapshot,
  waitForLifecycleSnapshot,
} from '../src/core/matrix';

describe('waitForLifecycleSnapshot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves immediately when current snapshot matches predicate', async () => {
    const source = {
      getSnapshot: () =>
        ({
          startupStatus: 'ready',
          startupReason: undefined,
          proxyStatus: 'connected',
          connectionState: 'connected',
        }) as MatrixLifecycleSnapshot,
      subscribe: jest.fn(() => () => undefined),
    };

    const snapshot = await waitForLifecycleSnapshot(
      source,
      s => s.startupStatus === 'ready',
      {timeoutMs: 1000},
    );

    expect(snapshot.startupStatus).toBe('ready');
    expect(source.subscribe).not.toHaveBeenCalled();
  });

  it('resolves after lifecycle event updates snapshot to match predicate', async () => {
    let listener: (() => void) | null = null;
    let snapshot: MatrixLifecycleSnapshot = {
      startupStatus: 'idle',
      proxyStatus: 'disabled',
      connectionState: 'disconnected',
    };

    const source = {
      getSnapshot: () => snapshot,
      subscribe: (cb: () => void) => {
        listener = cb;
        return () => {
          listener = null;
        };
      },
    };

    const waiterPromise = waitForLifecycleSnapshot(
      source,
      s => s.connectionState === 'connected',
      {timeoutMs: 1000},
    );

    snapshot = {
      ...snapshot,
      connectionState: 'connected',
    };
    listener?.();

    await expect(waiterPromise).resolves.toMatchObject({
      connectionState: 'connected',
    });
  });

  it('rejects with typed timeout error when predicate is never met', async () => {
    const source = {
      getSnapshot: () =>
        ({
          startupStatus: 'idle',
          proxyStatus: 'disabled',
          connectionState: 'disconnected',
        }) as MatrixLifecycleSnapshot,
      subscribe: () => () => undefined,
    };

    const waiterPromise = waitForLifecycleSnapshot(
      source,
      s => s.startupStatus === 'ready',
      {timeoutMs: 250},
    );

    const assertion = expect(waiterPromise).rejects.toMatchObject({
      code: 'MATRIX_LIFECYCLE_WAIT_TIMEOUT',
      name: 'SautiError',
    });

    await jest.advanceTimersByTimeAsync(250);
    await assertion;
  });
});
