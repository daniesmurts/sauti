import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

const MAX_ACTIVE_INVITES = 10;

export interface FamilyInviteRecord {
  id: string;
  inviteToken: string;
  inviteeMatrixUserId: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
}

export interface CreateFamilyInviteRepository {
  findSubscription(
    matrixUserId: string,
  ): Promise<{plan: string; status: string} | null>;
  countActiveInvites(payerMatrixUserId: string): Promise<number>;
  createInvite(payerMatrixUserId: string): Promise<FamilyInviteRecord>;
}

export interface CreateFamilyInviteResult {
  inviteToken: string;
  expiresAt: string;
  deepLink: string;
}

function isRequest(value: unknown): value is {payerMatrixUserId: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return typeof (value as Record<string, unknown>).payerMatrixUserId === 'string';
}

export function createFamilyInviteHandler(
  repository: CreateFamilyInviteRepository,
) {
  return async function handleCreateFamilyInvite(
    request: unknown,
  ): Promise<EdgeResponse<CreateFamilyInviteResult | {error: string}>> {
    if (!isRequest(request)) {
      return jsonResponse(400, {error: 'payerMatrixUserId is required.'});
    }

    const payerMatrixUserId = request.payerMatrixUserId.trim();
    if (payerMatrixUserId.length === 0) {
      return jsonResponse(400, {error: 'payerMatrixUserId is required.'});
    }

    let subscription: {plan: string; status: string} | null;
    try {
      subscription = await repository.findSubscription(payerMatrixUserId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    if (!subscription || subscription.plan !== 'family' || subscription.status !== 'active') {
      return jsonResponse(403, {
        error: 'Only active family plan subscribers can create invites.',
      });
    }

    let activeCount: number;
    try {
      activeCount = await repository.countActiveInvites(payerMatrixUserId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    if (activeCount >= MAX_ACTIVE_INVITES) {
      return jsonResponse(429, {
        error: `Maximum of ${MAX_ACTIVE_INVITES} active invites allowed.`,
      });
    }

    let invite: FamilyInviteRecord;
    try {
      invite = await repository.createInvite(payerMatrixUserId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    return jsonResponse(200, {
      inviteToken: invite.inviteToken,
      expiresAt: invite.expiresAt,
      deepLink: `sauti://invite/${invite.inviteToken}`,
    });
  };
}
