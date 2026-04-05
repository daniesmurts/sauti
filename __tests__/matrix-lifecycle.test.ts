import {MatrixLifecycleService} from '../src/core/matrix/MatrixLifecycleService';

describe('MatrixLifecycleService', () => {
  it('exposes default snapshot before startup', () => {
    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
    });

    expect(service.getSnapshot()).toEqual({
      startupStatus: 'idle',
      proxyStatus: 'disabled',
      connectionState: 'disconnected',
    });
  });

  it('stores runtime when startup result is ready', async () => {
    const recoverAfterNetworkLoss = jest.fn(async () => undefined);
    const proxyStatuses: string[] = [];
    const refreshNow = jest.fn(async () => undefined);

    const timelineReconciliation = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(async () => ({
        status: 'ready',
        boot: {
          homeserverDomain: 'example.org',
          runtime: {
            recoverAfterNetworkLoss,
            getProxyStatus: () => 'connected',
          },
        },
      })),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
      tokenRefresher: {
        refreshNow,
      },
      timelineReconciliation,
    });

    const unsubscribe = service.subscribe(event => {
      if (event.type === 'proxyStatusChanged') {
        proxyStatuses.push(event.status);
      }
    });

    const result = await service.start(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn().mockResolvedValue({
          userId: '@alice:example.org',
          accessToken: 'token-123',
        }),
      },
    );

    expect(result.status).toBe('ready');
    expect(timelineReconciliation.start).toHaveBeenCalledTimes(1);
    expect(timelineReconciliation.stop).not.toHaveBeenCalled();
    expect(service.isRuntimeReady()).toBe(true);
    expect(service.getSnapshot()).toEqual({
      startupStatus: 'ready',
      startupReason: undefined,
      proxyStatus: 'connected',
      connectionState: 'disconnected',
    });

    await service.recover();
    expect(recoverAfterNetworkLoss).toHaveBeenCalledTimes(1);
    expect(refreshNow).toHaveBeenCalledTimes(2);
    unsubscribe();

    expect(proxyStatuses).toEqual(['connected', 'connected']);
  });

  it('keeps runtime unavailable when startup returns signed_out', async () => {
    const proxyStatuses: string[] = [];
    const timelineReconciliation = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(async () => ({
        status: 'signed_out',
        reason: 'session_missing',
      })),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
      timelineReconciliation,
    });

    const unsubscribe = service.subscribe(event => {
      if (event.type === 'proxyStatusChanged') {
        proxyStatuses.push(event.status);
      }
    });

    const result = await service.start(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn(),
      },
    );

    expect(result).toEqual({status: 'signed_out', reason: 'session_missing'});
    expect(timelineReconciliation.start).not.toHaveBeenCalled();
    expect(timelineReconciliation.stop).toHaveBeenCalledTimes(1);
    expect(service.isRuntimeReady()).toBe(false);
    expect(service.getSnapshot()).toEqual({
      startupStatus: 'signed_out',
      startupReason: 'session_missing',
      proxyStatus: 'disabled',
      connectionState: 'disconnected',
    });
    unsubscribe();

    expect(proxyStatuses).toEqual(['disabled']);
  });

  it('throws typed recovery error when runtime has not started', async () => {
    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
    });

    await expect(service.recover()).rejects.toMatchObject({
      code: 'MATRIX_RUNTIME_RECOVERY_FAILED',
      name: 'SautiError',
    });
  });

  it('delegates logout and clears runtime state', async () => {
    const execute = jest.fn(async () => ({
      revokedSession: true,
      clearedSecureSession: true,
      wipedLocalDb: true,
    }));

    const timelineReconciliation = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(async () => ({
        status: 'ready',
        boot: {
          homeserverDomain: 'example.org',
          runtime: {
            recoverAfterNetworkLoss: jest.fn(async () => undefined),
            getProxyStatus: () => 'connected',
          },
        },
      })),
      logoutOrchestrator: {
        execute,
      } as never,
      timelineReconciliation,
    });

    await service.start(
      {
        getSyncToken: jest.fn().mockResolvedValue(null),
        saveSyncToken: jest.fn().mockResolvedValue(undefined),
      },
      {
        getRequiredValidSession: jest.fn().mockResolvedValue({
          userId: '@alice:example.org',
          accessToken: 'token',
        }),
      },
    );

    const report = await service.logout();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(timelineReconciliation.start).toHaveBeenCalledTimes(1);
    expect(timelineReconciliation.stop).toHaveBeenCalledTimes(1);
    expect(report).toEqual({
      revokedSession: true,
      clearedSecureSession: true,
      wipedLocalDb: true,
    });
    expect(service.isRuntimeReady()).toBe(false);
    expect(service.getSnapshot()).toEqual({
      startupStatus: 'signed_out',
      startupReason: undefined,
      proxyStatus: 'disabled',
      connectionState: 'disconnected',
    });
  });

  it('forwards Matrix connection state events from matrix event source', async () => {
    let matrixListener: ((event: {type: string; state?: string}) => void) | null =
      null;
    const connectionStates: string[] = [];

    const service = new MatrixLifecycleService({
      startFromStoredSession: jest.fn(async () => ({
        status: 'signed_out',
        reason: 'session_missing',
      })),
      logoutOrchestrator: {
        execute: jest.fn(async () => ({
          revokedSession: true,
          clearedSecureSession: true,
          wipedLocalDb: true,
        })),
      } as never,
      matrixEventSource: {
        subscribe: listener => {
          matrixListener = listener as never;
          return () => {
            matrixListener = null;
          };
        },
      },
    });

    const unsubscribe = service.subscribe(event => {
      if (event.type === 'connectionStateChanged') {
        connectionStates.push(event.state);
      }
    });

    matrixListener?.({type: 'connectionStateChanged', state: 'reconnecting'});
    matrixListener?.({type: 'connectionStateChanged', state: 'connected'});

    unsubscribe();

    expect(connectionStates).toEqual(['reconnecting', 'connected']);
    expect(service.getSnapshot()).toEqual({
      startupStatus: 'idle',
      proxyStatus: 'disabled',
      connectionState: 'connected',
    });
  });
});
