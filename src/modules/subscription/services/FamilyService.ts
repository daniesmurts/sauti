import {readSupabaseEnv} from '../../../core/config/env';
import {logger} from '../../../utils/logger';

export interface FamilyInvite {
  id: string;
  inviteToken: string;
  inviteeMatrixUserId: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
  deepLink: string;
}

export interface EntitlementResult {
  allowed: boolean;
  reason: string;
}

interface CreateInviteResponse {
  inviteToken: string;
  expiresAt: string;
  deepLink: string;
}

interface AcceptInviteResponse {
  payerMatrixUserId: string;
  accepted: boolean;
}

interface EntitlementResponse {
  allowed: boolean;
  reason: string;
}

interface FamilyInviteRow {
  id: string;
  invite_token: string;
  invitee_matrix_user_id: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isCreateInviteResponse(value: unknown): value is CreateInviteResponse {
  if (!isObject(value)) return false;
  return (
    typeof value.inviteToken === 'string' &&
    typeof value.expiresAt === 'string' &&
    typeof value.deepLink === 'string'
  );
}

function isAcceptInviteResponse(value: unknown): value is AcceptInviteResponse {
  if (!isObject(value)) return false;
  return typeof value.payerMatrixUserId === 'string' && typeof value.accepted === 'boolean';
}

function isEntitlementResponse(value: unknown): value is EntitlementResponse {
  if (!isObject(value)) return false;
  return typeof value.allowed === 'boolean' && typeof value.reason === 'string';
}

function isFamilyInviteRow(value: unknown): value is FamilyInviteRow {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.invite_token === 'string' &&
    (value.invitee_matrix_user_id === null ||
      typeof value.invitee_matrix_user_id === 'string') &&
    (value.status === 'pending' ||
      value.status === 'accepted' ||
      value.status === 'revoked') &&
    typeof value.created_at === 'string' &&
    typeof value.expires_at === 'string'
  );
}

function rowToInvite(row: FamilyInviteRow): FamilyInvite {
  return {
    id: row.id,
    inviteToken: row.invite_token,
    inviteeMatrixUserId: row.invitee_matrix_user_id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deepLink: `sauti://invite/${row.invite_token}`,
  };
}

export class FamilyService {
  private readonly supabaseUrl: string;
  private readonly anonKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(supabaseUrl: string, anonKey: string, fetchFn: typeof fetch = fetch) {
    this.supabaseUrl = supabaseUrl;
    this.anonKey = anonKey;
    this.fetchFn = fetchFn;
  }

  async createInvite(payerMatrixUserId: string): Promise<FamilyInvite> {
    const response = await this.fetchFn(
      `${this.supabaseUrl}/functions/v1/create-family-invite`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({payerMatrixUserId}),
      },
    );

    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        isObject(payload) && typeof payload.error === 'string'
          ? payload.error
          : `create-family-invite failed with status ${response.status}`;
      logger.error('FamilyService.createInvite failed', {message});
      throw new Error(message);
    }

    if (!isCreateInviteResponse(payload)) {
      throw new Error('Invalid response from create-family-invite.');
    }

    return {
      id: '',
      inviteToken: payload.inviteToken,
      inviteeMatrixUserId: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: payload.expiresAt,
      deepLink: payload.deepLink,
    };
  }

  async acceptInvite(
    token: string,
    inviteeMatrixUserId: string,
  ): Promise<{payerMatrixUserId: string}> {
    const response = await this.fetchFn(
      `${this.supabaseUrl}/functions/v1/accept-family-invite`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({inviteToken: token, inviteeMatrixUserId}),
      },
    );

    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        isObject(payload) && typeof payload.error === 'string'
          ? payload.error
          : `accept-family-invite failed with status ${response.status}`;
      logger.error('FamilyService.acceptInvite failed', {message});
      throw new Error(message);
    }

    if (!isAcceptInviteResponse(payload)) {
      throw new Error('Invalid response from accept-family-invite.');
    }

    return {payerMatrixUserId: payload.payerMatrixUserId};
  }

  async checkEntitlement(
    senderMatrixUserId: string,
    recipientMatrixUserId: string,
  ): Promise<EntitlementResult> {
    const response = await this.fetchFn(
      `${this.supabaseUrl}/functions/v1/check-family-entitlement`,
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({senderMatrixUserId, recipientMatrixUserId}),
      },
    );

    const payload: unknown = await response.json();

    if (!response.ok) {
      const message =
        isObject(payload) && typeof payload.error === 'string'
          ? payload.error
          : `check-family-entitlement failed with status ${response.status}`;
      logger.error('FamilyService.checkEntitlement failed', {message});
      throw new Error(message);
    }

    if (!isEntitlementResponse(payload)) {
      throw new Error('Invalid response from check-family-entitlement.');
    }

    return {allowed: payload.allowed, reason: payload.reason};
  }

  async getMyInvites(payerMatrixUserId: string): Promise<FamilyInvite[]> {
    const encodedId = encodeURIComponent(payerMatrixUserId);
    const response = await this.fetchFn(
      `${this.supabaseUrl}/rest/v1/family_invites?payer_matrix_user_id=eq.${encodedId}&order=created_at.desc`,
      {
        method: 'GET',
        headers: this.restHeaders(),
      },
    );

    if (!response.ok) {
      const message = `getMyInvites failed with status ${response.status}`;
      logger.error('FamilyService.getMyInvites failed', {message});
      throw new Error(message);
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error('Invalid response from PostgREST family_invites.');
    }

    return payload.filter(isFamilyInviteRow).map(rowToInvite);
  }

  async revokeInvite(inviteId: string, payerMatrixUserId: string): Promise<void> {
    const encodedId = encodeURIComponent(inviteId);
    const encodedPayer = encodeURIComponent(payerMatrixUserId);
    const response = await this.fetchFn(
      `${this.supabaseUrl}/rest/v1/family_invites?id=eq.${encodedId}&payer_matrix_user_id=eq.${encodedPayer}`,
      {
        method: 'PATCH',
        headers: this.restHeaders(),
        body: JSON.stringify({status: 'revoked'}),
      },
    );

    if (!response.ok) {
      const message = `revokeInvite failed with status ${response.status}`;
      logger.error('FamilyService.revokeInvite failed', {message});
      throw new Error(message);
    }
  }

  private jsonHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
    };
  }

  private restHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
      Prefer: 'return=representation',
    };
  }
}

function createFamilyService(): FamilyService {
  const env = readSupabaseEnv();
  return new FamilyService(env.supabaseUrl, env.supabaseAnonKey);
}

export const familyService = createFamilyService();
