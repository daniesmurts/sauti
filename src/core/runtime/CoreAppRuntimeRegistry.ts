import {CoreAppRuntime, CoreAppRuntimeOptions, createCoreAppRuntime} from './createCoreAppRuntime';

let runtimeInstance: CoreAppRuntime | null = null;

export function hasCoreAppRuntime(): boolean {
  return runtimeInstance !== null;
}

export function initializeCoreAppRuntime(
  options: CoreAppRuntimeOptions,
  settings: {replaceExisting?: boolean} = {},
): CoreAppRuntime {
  if (runtimeInstance && !settings.replaceExisting) {
    throw new Error('Core app runtime is already initialized.');
  }

  if (runtimeInstance && settings.replaceExisting) {
    runtimeInstance.stop();
  }

  runtimeInstance = createCoreAppRuntime(options);
  return runtimeInstance;
}

export function getCoreAppRuntime(): CoreAppRuntime {
  if (!runtimeInstance) {
    throw new Error('Core app runtime has not been initialized.');
  }

  return runtimeInstance;
}

export function getCoreMessagingRuntime(): CoreAppRuntime['messaging'] {
  return getCoreAppRuntime().messaging;
}

export function getCoreDatabase(): CoreAppRuntime['database'] {
  return getCoreAppRuntime().database;
}

export function resetCoreAppRuntimeForTests(): void {
  if (runtimeInstance) {
    runtimeInstance.stop();
  }

  runtimeInstance = null;
}
