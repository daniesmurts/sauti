import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface CheckFamilyEntitlementRepository {
  hasActiveFamilySubscription(matrixUserId: string): Promise<boolean>;
  hasAcceptedInvite(payerMatrixUserId: string, inviteeMatrixUserId: string): Promise<boolean>;
}

export interface EntitlementResult {
  allowed: boolean;
  reason: string;
}

function isRequest(
  value: unknown,
): value is {senderMatrixUserId: string; recipientMatrixUserId: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return (
    typeof v.senderMatrixUserId === 'string' &&
    typeof v.recipientMatrixUserId === 'string'
  );
}

export function createCheckFamilyEntitlementHandler(
  repository: CheckFamilyEntitlementRepository,
) {
  return async function handleCheckFamilyEntitlement(
    request: unknown,
  ): Promise<EdgeResponse<EntitlementResult | {error: string}>> {
    if (!isRequest(request)) {
      return jsonResponse(400, {
        error: 'senderMatrixUserId and recipientMatrixUserId are required.',
      });
    }

    const senderMatrixUserId = request.senderMatrixUserId.trim();
    const recipientMatrixUserId = request.recipientMatrixUserId.trim();

    if (senderMatrixUserId.length === 0 || recipientMatrixUserId.length === 0) {
      return jsonResponse(400, {
        error: 'senderMatrixUserId and recipientMatrixUserId are required.',
      });
    }

    try {
      // Rule 1: sender has their own active family subscription
      const senderHasSubscription =
        await repository.hasActiveFamilySubscription(senderMatrixUserId);
      if (senderHasSubscription) {
        return jsonResponse(200, {
          allowed: true,
          reason: 'sender has an active family subscription',
        });
      }

      // Rule 2 & 3: sender was invited by recipient
      // i.e. there is an accepted invite where payer=recipient AND invitee=sender
      const senderWasInvitedByRecipient = await repository.hasAcceptedInvite(
        recipientMatrixUserId,
        senderMatrixUserId,
      );
      if (senderWasInvitedByRecipient) {
        return jsonResponse(200, {
          allowed: true,
          reason: 'sender was invited by recipient',
        });
      }

      return jsonResponse(200, {
        allowed: false,
        reason: 'sender does not have an active family subscription or accepted invite',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }
  };
}
