jest.mock('../src/app/startup/AppStartupRuntime', () => ({
  bootAppRuntime: jest.fn(),
  getAppStartupSnapshot: jest.fn(),
}));

import {bootAppRuntime, getAppStartupSnapshot} from '../src/app/startup/AppStartupRuntime';
import {launchAppRuntime} from '../src/app';

describe('launchAppRuntime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ready terminal snapshot after successful boot', async () => {
    (bootAppRuntime as jest.Mock).mockResolvedValue(undefined);
    (getAppStartupSnapshot as jest.Mock).mockReturnValue({
      status: 'ready',
    });

    const result = await launchAppRuntime();

    expect(result).toEqual({status: 'ready', reason: undefined, errorMessage: undefined});
  });

  it('returns signed_out terminal snapshot after successful boot', async () => {
    (bootAppRuntime as jest.Mock).mockResolvedValue(undefined);
    (getAppStartupSnapshot as jest.Mock).mockReturnValue({
      status: 'signed_out',
      reason: 'session_missing',
    });

    const result = await launchAppRuntime();

    expect(result).toEqual({
      status: 'signed_out',
      reason: 'session_missing',
      errorMessage: undefined,
    });
  });

  it('returns error when boot resolves with non-terminal state', async () => {
    (bootAppRuntime as jest.Mock).mockResolvedValue(undefined);
    (getAppStartupSnapshot as jest.Mock).mockReturnValue({
      status: 'initializing',
    });

    const result = await launchAppRuntime();

    expect(result).toEqual({
      status: 'error',
      errorMessage: 'Startup resolved with non-terminal status: initializing',
    });
  });

  it('returns snapshot error when boot throws and orchestrator already has error state', async () => {
    (bootAppRuntime as jest.Mock).mockRejectedValue(new Error('boom'));
    (getAppStartupSnapshot as jest.Mock).mockReturnValue({
      status: 'error',
      errorMessage: 'runtime failed',
    });

    const result = await launchAppRuntime();

    expect(result).toEqual({
      status: 'error',
      errorMessage: 'runtime failed',
    });
  });

  it('returns thrown error message when boot throws before error snapshot is set', async () => {
    (bootAppRuntime as jest.Mock).mockRejectedValue(new Error('early failure'));
    (getAppStartupSnapshot as jest.Mock).mockReturnValue({
      status: 'idle',
    });

    const result = await launchAppRuntime();

    expect(result).toEqual({
      status: 'error',
      errorMessage: 'early failure',
    });
  });
});
