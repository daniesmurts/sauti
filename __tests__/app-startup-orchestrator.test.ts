import {createAppStartupOrchestrator} from '../src/app';

describe('createAppStartupOrchestrator', () => {
  it('delegates initialize and resume to bootstrap and auth controller', async () => {
    let authListener: ((snapshot: {status: 'idle' | 'resuming' | 'ready'}) => void) | null =
      null;
    let bootstrapListener: ((snapshot: {status: 'idle' | 'starting'}) => void) | null =
      null;

    const orchestrator = createAppStartupOrchestrator({
      authController: {
        getSnapshot: () => ({status: 'idle'}),
        subscribe: listener => {
          authListener = listener;
          return () => {
            authListener = null;
          };
        },
        registerAndBootstrap: jest.fn(async () => undefined),
        resumeFromStoredSession: jest.fn(async () => {
          authListener?.({status: 'resuming'});
          authListener?.({status: 'ready'});
        }),
        reset: jest.fn(),
      },
      bootstrap: {
        ensureInitialized: jest.fn(() => {
          bootstrapListener?.({status: 'starting'});
        }),
        getSnapshot: () => ({status: 'idle'}),
        subscribe: listener => {
          bootstrapListener = listener;
          return () => {
            bootstrapListener = null;
          };
        },
        stop: jest.fn(),
      },
    });

    await orchestrator.initializeAndResume();

    expect(orchestrator.getSnapshot().status).toBe('ready');
  });

  it('derives signed_out and error states from auth/bootstrap streams', () => {
    let authListener:
      | ((snapshot: {
          status: 'idle' | 'signed_out' | 'error';
          reason?: 'session_missing';
          errorMessage?: string;
        }) => void)
      | null = null;
    let bootstrapListener:
      | ((snapshot: {
          status: 'idle' | 'signed_out' | 'error';
          reason?: 'session_missing';
          errorMessage?: string;
        }) => void)
      | null = null;

    const orchestrator = createAppStartupOrchestrator({
      authController: {
        getSnapshot: () => ({status: 'idle'}),
        subscribe: listener => {
          authListener = listener;
          return () => {
            authListener = null;
          };
        },
        registerAndBootstrap: jest.fn(async () => undefined),
        resumeFromStoredSession: jest.fn(async () => undefined),
        reset: jest.fn(),
      },
      bootstrap: {
        ensureInitialized: jest.fn(),
        getSnapshot: () => ({status: 'idle'}),
        subscribe: listener => {
          bootstrapListener = listener;
          return () => {
            bootstrapListener = null;
          };
        },
        stop: jest.fn(),
      },
    });

    authListener?.({status: 'signed_out', reason: 'session_missing'});
    expect(orchestrator.getSnapshot()).toMatchObject({
      status: 'signed_out',
      reason: 'session_missing',
    });

    authListener?.({status: 'idle'});
    bootstrapListener?.({status: 'error', errorMessage: 'bootstrap failed'});
    expect(orchestrator.getSnapshot()).toMatchObject({
      status: 'error',
      errorMessage: 'bootstrap failed',
    });
  });

  it('subscribes listeners immediately and supports stop/reset delegation', () => {
    const stop = jest.fn();
    const reset = jest.fn();

    const orchestrator = createAppStartupOrchestrator({
      authController: {
        getSnapshot: () => ({status: 'idle'}),
        subscribe: () => () => undefined,
        registerAndBootstrap: jest.fn(async () => undefined),
        resumeFromStoredSession: jest.fn(async () => undefined),
        reset,
      },
      bootstrap: {
        ensureInitialized: jest.fn(),
        getSnapshot: () => ({status: 'idle'}),
        subscribe: () => () => undefined,
        stop,
      },
    });

    const seen: string[] = [];
    const unsubscribe = orchestrator.subscribe(snapshot => {
      seen.push(snapshot.status);
    });

    orchestrator.stop();
    orchestrator.reset();
    unsubscribe();

    expect(seen).toEqual(['idle']);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
