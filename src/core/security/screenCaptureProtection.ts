import React from 'react';

type ScreenshotPreventModule = {
  enabled?: (value: boolean) => void;
  enableSecureView?: () => void;
  disableSecureView?: () => void;
};

function getScreenshotPreventModule(): ScreenshotPreventModule | null {
  try {
    // Lazy require keeps tests and unsupported runtimes from crashing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-screenshot-prevent') as ScreenshotPreventModule;
  } catch {
    return null;
  }
}

const screenshotPreventModule = getScreenshotPreventModule();

export function setScreenCaptureProtection(enabled: boolean): void {
  const module = screenshotPreventModule;

  if (!module) {
    return;
  }

  try {
    if (typeof module.enabled === 'function') {
      module.enabled(enabled);
      return;
    }

    if (enabled && typeof module.enableSecureView === 'function') {
      module.enableSecureView();
      return;
    }

    if (!enabled && typeof module.disableSecureView === 'function') {
      module.disableSecureView();
    }
  } catch {
    // Never crash rendering if native module is unavailable at runtime.
  }
}

export function useScreenCaptureProtection(shouldProtect: boolean): void {
  React.useEffect(() => {
    if (!shouldProtect) {
      return;
    }

    setScreenCaptureProtection(true);

    return () => {
      setScreenCaptureProtection(false);
    };
  }, [shouldProtect]);
}