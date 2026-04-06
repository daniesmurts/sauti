import React from 'react';

import {logger} from '../../../utils/logger';

type AuthServiceLike = {
  getSession(): Promise<unknown | null>;
  getTotpStatus(): Promise<{enabled: boolean}>;
};

function resolveAuthService(): AuthServiceLike {
  // Lazy resolution avoids pulling env-dependent singleton at module import time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../core/auth/AuthService').authService as AuthServiceLike;
}

interface UseAuthRedirectOptions {
  onMain(): void;
  onEmailEntry(): void;
  onTotpVerification(): void;
}

export function useAuthRedirect({
  onMain,
  onEmailEntry,
  onTotpVerification,
}: UseAuthRedirectOptions): void {
  React.useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const authService = resolveAuthService();
        const session = await authService.getSession();
        if (!active) {
          return;
        }

        if (!session) {
          onEmailEntry();
          return;
        }

        const totp = await authService.getTotpStatus();
        if (!active) {
          return;
        }

        if (totp.enabled) {
          onTotpVerification();
          return;
        }

        onMain();
      } catch (error) {
        logger.error('Auth redirect failed.', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        if (active) {
          onEmailEntry();
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [onEmailEntry, onMain, onTotpVerification]);
}