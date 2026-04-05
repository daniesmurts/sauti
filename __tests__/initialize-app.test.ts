jest.mock('../src/app/startup', () => ({
  launchAppRuntime: jest.fn(),
}));

import {launchAppRuntime} from '../src/app/startup';
import {initializeApp} from '../src/app';

describe('initializeApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes to main when startup is ready', async () => {
    (launchAppRuntime as jest.Mock).mockResolvedValue({
      status: 'ready',
    });

    const result = await initializeApp();

    expect(result).toEqual({
      route: 'main',
      startup: {
        status: 'ready',
      },
    });
  });

  it('routes to auth when startup is signed_out', async () => {
    (launchAppRuntime as jest.Mock).mockResolvedValue({
      status: 'signed_out',
      reason: 'session_missing',
    });

    const result = await initializeApp();

    expect(result).toEqual({
      route: 'auth',
      startup: {
        status: 'signed_out',
        reason: 'session_missing',
      },
    });
  });

  it('routes to auth when startup is error', async () => {
    (launchAppRuntime as jest.Mock).mockResolvedValue({
      status: 'error',
      errorMessage: 'runtime failed',
    });

    const result = await initializeApp();

    expect(result).toEqual({
      route: 'auth',
      startup: {
        status: 'error',
        errorMessage: 'runtime failed',
      },
    });
  });
});
