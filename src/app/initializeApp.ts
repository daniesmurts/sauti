import {EnsureCoreRuntimeOptions} from './bootstrap';
import {launchAppRuntime, TerminalAppStartupSnapshot} from './startup';

export type AppRootRoute = 'main' | 'auth';

export interface AppInitializationResult {
  route: AppRootRoute;
  startup: TerminalAppStartupSnapshot;
}

function decideRoute(
  startup: TerminalAppStartupSnapshot,
): AppRootRoute {
  return startup.status === 'ready' ? 'main' : 'auth';
}

export async function initializeApp(
  options?: EnsureCoreRuntimeOptions,
): Promise<AppInitializationResult> {
  const startup = await launchAppRuntime(options);

  return {
    route: decideRoute(startup),
    startup,
  };
}
