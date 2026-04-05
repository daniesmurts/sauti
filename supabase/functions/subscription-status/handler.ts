import {EdgeResponse, jsonResponse} from '../_shared/http';

export type SubscriptionPlan = 'free' | 'family';
export type SubscriptionState = 'active' | 'expired' | 'cancelled';

export interface SubscriptionStatus {
  matrixUserId: string;
  plan: SubscriptionPlan;
  status: SubscriptionState;
  currentPeriodEnd?: string;
}

export interface SubscriptionStatusRepository {
  findByMatrixUserId(matrixUserId: string): Promise<SubscriptionStatus | null>;
}

function isRequest(value: unknown): value is {matrixUserId: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return typeof (value as Record<string, unknown>).matrixUserId === 'string';
}

export function createSubscriptionStatusHandler(
  repository: SubscriptionStatusRepository,
) {
  return async function handleSubscriptionStatus(
    request: unknown,
  ): Promise<EdgeResponse<SubscriptionStatus | {error: string}>> {
    if (!isRequest(request)) {
      return jsonResponse(400, {error: 'matrixUserId is required.'});
    }

    const matrixUserId = request.matrixUserId.trim();
    if (matrixUserId.length === 0) {
      return jsonResponse(400, {error: 'matrixUserId is required.'});
    }

    const found = await repository.findByMatrixUserId(matrixUserId);
    if (found) {
      return jsonResponse(200, found);
    }

    return jsonResponse(200, {
      matrixUserId,
      plan: 'free',
      status: 'active',
    });
  };
}
