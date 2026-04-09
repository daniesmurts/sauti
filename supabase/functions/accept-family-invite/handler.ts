import {EdgeResponse, jsonResponse} from '../_shared/http.ts';

export interface FamilyInviteRow {
  id: string;
  payerMatrixUserId: string;
  inviteeMatrixUserId: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: string;
}

export interface AcceptFamilyInviteRepository {
  findInviteByToken(token: string): Promise<FamilyInviteRow | null>;
  acceptInvite(inviteId: string, inviteeMatrixUserId: string, acceptedAt: string): Promise<void>;
}

export interface AcceptFamilyInviteResult {
  payerMatrixUserId: string;
  accepted: true;
}

function isRequest(
  value: unknown,
): value is {inviteToken: string; inviteeMatrixUserId: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const v = value as Record<string, unknown>;
  return typeof v.inviteToken === 'string' && typeof v.inviteeMatrixUserId === 'string';
}

export function createAcceptFamilyInviteHandler(
  repository: AcceptFamilyInviteRepository,
  now: () => Date = () => new Date(),
) {
  return async function handleAcceptFamilyInvite(
    request: unknown,
  ): Promise<EdgeResponse<AcceptFamilyInviteResult | {error: string}>> {
    if (!isRequest(request)) {
      return jsonResponse(400, {error: 'inviteToken and inviteeMatrixUserId are required.'});
    }

    const inviteToken = request.inviteToken.trim();
    const inviteeMatrixUserId = request.inviteeMatrixUserId.trim();

    if (inviteToken.length === 0 || inviteeMatrixUserId.length === 0) {
      return jsonResponse(400, {error: 'inviteToken and inviteeMatrixUserId are required.'});
    }

    let invite: FamilyInviteRow | null;
    try {
      invite = await repository.findInviteByToken(inviteToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    if (!invite) {
      return jsonResponse(400, {error: 'Invite not found.'});
    }

    if (invite.status !== 'pending') {
      return jsonResponse(400, {
        error: `Invite is already ${invite.status}.`,
      });
    }

    const currentTime = now();
    if (currentTime > new Date(invite.expiresAt)) {
      return jsonResponse(400, {error: 'Invite has expired.'});
    }

    if (invite.payerMatrixUserId === inviteeMatrixUserId) {
      return jsonResponse(400, {error: 'Invitee cannot be the same as the payer.'});
    }

    try {
      await repository.acceptInvite(invite.id, inviteeMatrixUserId, currentTime.toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error.';
      return jsonResponse(500, {error: message});
    }

    return jsonResponse(200, {
      payerMatrixUserId: invite.payerMatrixUserId,
      accepted: true,
    });
  };
}
