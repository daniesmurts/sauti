import React from 'react';

import {logger} from '../../../utils/logger';
import {
  SubscriptionStatusService,
} from '../api/SubscriptionStatusService';
import {FamilyService, EntitlementResult} from '../services/FamilyService';

export type GateStatus = 'idle' | 'checking' | 'allowed' | 'blocked';

export interface SubscriptionGateResult {
  status: GateStatus;
  reason: string;
  /** Trigger an entitlement check. Safe to call multiple times. */
  check(): void;
  /** Reset back to idle (call when target changes). */
  reset(): void;
}

export interface UseSubscriptionGateOptions {
  subscriptionService?: SubscriptionStatusService;
  familyService?: Pick<FamilyService, 'checkEntitlement'>;
}

let _defaultSubscriptionService: SubscriptionStatusService | null = null;
function getDefaultSubscriptionService(): SubscriptionStatusService {
  if (!_defaultSubscriptionService) {
    _defaultSubscriptionService = new SubscriptionStatusService();
  }
  return _defaultSubscriptionService;
}

let _defaultFamilyService: FamilyService | null = null;
function getDefaultFamilyService(): FamilyService {
  if (!_defaultFamilyService) {
    _defaultFamilyService = new FamilyService();
  }
  return _defaultFamilyService;
}

export function useSubscriptionGate(
  senderMatrixUserId: string | null,
  recipientMatrixUserId: string | null,
  options: UseSubscriptionGateOptions = {},
): SubscriptionGateResult {
  const [status, setStatus] = React.useState<GateStatus>('idle');
  const [reason, setReason] = React.useState('');
  const checkingRef = React.useRef(false);

  const subscriptionService =
    options.subscriptionService ?? getDefaultSubscriptionService();
  const familyService =
    options.familyService ?? getDefaultFamilyService();

  const check = React.useCallback(() => {
    // No IDs → always allow
    if (!senderMatrixUserId || !recipientMatrixUserId) {
      setStatus('allowed');
      setReason('no_ids');
      return;
    }

    // Guard against concurrent checks
    if (checkingRef.current) {
      return;
    }
    checkingRef.current = true;
    setStatus('checking');

    const run = async () => {
      try {
        // Step 1: fast-path — cached subscription status
        const sub = await subscriptionService.getStatus(senderMatrixUserId);
        if (sub.plan === 'family' && sub.status === 'active') {
          setStatus('allowed');
          setReason('active_subscription');
          return;
        }

        // Step 2: entitlement check via edge function
        let entitlement: EntitlementResult;
        try {
          entitlement = await familyService.checkEntitlement(
            senderMatrixUserId,
            recipientMatrixUserId,
          );
        } catch (entError) {
          // Fail open on network errors — never block due to infra issues
          logger.warn('Entitlement check failed, failing open', {
            error: entError instanceof Error ? entError.message : String(entError),
          });
          setStatus('allowed');
          setReason('entitlement_check_failed');
          return;
        }

        if (entitlement.allowed) {
          setStatus('allowed');
          setReason(entitlement.reason);
        } else {
          setStatus('blocked');
          setReason('subscription_required');
        }
      } catch (error) {
        // Fail open — never block the user due to a subscription lookup error
        logger.warn('Subscription gate check failed, failing open', {
          error: error instanceof Error ? error.message : String(error),
        });
        setStatus('allowed');
        setReason('gate_check_failed');
      } finally {
        checkingRef.current = false;
      }
    };

    void run();
  }, [senderMatrixUserId, recipientMatrixUserId, subscriptionService, familyService]);

  const reset = React.useCallback(() => {
    checkingRef.current = false;
    setStatus('idle');
    setReason('');
  }, []);

  return {status, reason, check, reset};
}
