import {
  AppStartupOrchestrator,
  AppStartupSnapshot,
  createAppStartupOrchestrator,
  EnsureCoreRuntimeOptions,
} from '../bootstrap';

let orchestrator: AppStartupOrchestrator | null = null;

function getOrCreateOrchestrator(): AppStartupOrchestrator {
  if (!orchestrator) {
    orchestrator = createAppStartupOrchestrator();
  }

  return orchestrator;
}

export async function bootAppRuntime(
  options?: EnsureCoreRuntimeOptions,
): Promise<void> {
  await getOrCreateOrchestrator().initializeAndResume(options);
}

export function subscribeAppStartup(
  listener: (snapshot: AppStartupSnapshot) => void,
): () => void {
  return getOrCreateOrchestrator().subscribe(listener);
}

export function getAppStartupSnapshot(): AppStartupSnapshot {
  return getOrCreateOrchestrator().getSnapshot();
}

export function stopAppRuntime(): void {
  getOrCreateOrchestrator().stop();
}

export function resetAppStartupRuntimeForTests(): void {
  if (orchestrator) {
    orchestrator.reset();
  }

  orchestrator = null;
}
