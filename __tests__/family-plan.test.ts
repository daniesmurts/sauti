/**
 * Tests for family plan invite logic.
 *
 * Covers:
 *   1. create-family-invite handler
 *   2. accept-family-invite handler
 *   3. check-family-entitlement handler
 *   4. FamilyService unit tests
 */

import {createFamilyInviteHandler} from '../supabase/functions/create-family-invite/handler';
import {createAcceptFamilyInviteHandler} from '../supabase/functions/accept-family-invite/handler';
import {createCheckFamilyEntitlementHandler} from '../supabase/functions/check-family-entitlement/handler';
import {FamilyService} from '../src/modules/subscription/services/FamilyService';

// ─── create-family-invite ─────────────────────────────────────────────────────

describe('create-family-invite handler', () => {
  const activeInvite = {
    id: 'invite-1',
    inviteToken: 'abc123',
    inviteeMatrixUserId: null,
    status: 'pending' as const,
    createdAt: '2026-04-08T00:00:00.000Z',
    expiresAt: '2026-04-15T00:00:00.000Z',
  };

  it('creates an invite when payer has an active family plan', async () => {
    const repository = {
      findSubscription: jest.fn(async () => ({plan: 'family', status: 'active'})),
      countActiveInvites: jest.fn(async () => 0),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({payerMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      inviteToken: 'abc123',
      expiresAt: '2026-04-15T00:00:00.000Z',
      deepLink: 'sauti://invite/abc123',
    });
    expect(repository.createInvite).toHaveBeenCalledWith('@alice:sauti.app');
  });

  it('returns 403 when payer is on the free plan', async () => {
    const repository = {
      findSubscription: jest.fn(async () => ({plan: 'free', status: 'active'})),
      countActiveInvites: jest.fn(async () => 0),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({payerMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({error: expect.any(String)});
    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('returns 403 when payer subscription is expired', async () => {
    const repository = {
      findSubscription: jest.fn(async () => ({plan: 'family', status: 'expired'})),
      countActiveInvites: jest.fn(async () => 0),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({payerMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({error: expect.any(String)});
    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('returns 403 when payer has no subscription record', async () => {
    const repository = {
      findSubscription: jest.fn(async () => null),
      countActiveInvites: jest.fn(async () => 0),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({payerMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(403);
    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('returns 429 when payer already has 10 active invites', async () => {
    const repository = {
      findSubscription: jest.fn(async () => ({plan: 'family', status: 'active'})),
      countActiveInvites: jest.fn(async () => 10),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({payerMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({error: expect.any(String)});
    expect(repository.createInvite).not.toHaveBeenCalled();
  });

  it('returns 400 when payerMatrixUserId is missing', async () => {
    const repository = {
      findSubscription: jest.fn(async () => null),
      countActiveInvites: jest.fn(async () => 0),
      createInvite: jest.fn(async () => activeInvite),
    };

    const handler = createFamilyInviteHandler(repository);
    const response = await handler({});

    expect(response.status).toBe(400);
  });
});

// ─── accept-family-invite ─────────────────────────────────────────────────────

describe('accept-family-invite handler', () => {
  const pendingInvite = {
    id: 'invite-1',
    payerMatrixUserId: '@alice:sauti.app',
    inviteeMatrixUserId: null,
    status: 'pending' as const,
    expiresAt: '2099-01-01T00:00:00.000Z',
  };

  it('accepts a valid pending invite', async () => {
    const repository = {
      findInviteByToken: jest.fn(async () => pendingInvite),
      acceptInvite: jest.fn(async () => undefined),
    };

    const fixedNow = new Date('2026-04-08T12:00:00.000Z');
    const handler = createAcceptFamilyInviteHandler(repository, () => fixedNow);
    const response = await handler({
      inviteToken: 'abc123',
      inviteeMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      payerMatrixUserId: '@alice:sauti.app',
      accepted: true,
    });
    expect(repository.acceptInvite).toHaveBeenCalledWith(
      'invite-1',
      '@bob:sauti.app',
      fixedNow.toISOString(),
    );
  });

  it('returns 400 when invite token is not found', async () => {
    const repository = {
      findInviteByToken: jest.fn(async () => null),
      acceptInvite: jest.fn(async () => undefined),
    };

    const handler = createAcceptFamilyInviteHandler(repository);
    const response = await handler({
      inviteToken: 'nonexistent',
      inviteeMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({error: 'Invite not found.'});
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('returns 400 for an expired invite', async () => {
    const expiredInvite = {
      ...pendingInvite,
      expiresAt: '2020-01-01T00:00:00.000Z',
    };

    const repository = {
      findInviteByToken: jest.fn(async () => expiredInvite),
      acceptInvite: jest.fn(async () => undefined),
    };

    const handler = createAcceptFamilyInviteHandler(repository);
    const response = await handler({
      inviteToken: 'abc123',
      inviteeMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({error: 'Invite has expired.'});
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('returns 400 when invite is already accepted', async () => {
    const acceptedInvite = {
      ...pendingInvite,
      status: 'accepted' as const,
      inviteeMatrixUserId: '@carol:sauti.app',
    };

    const repository = {
      findInviteByToken: jest.fn(async () => acceptedInvite),
      acceptInvite: jest.fn(async () => undefined),
    };

    const handler = createAcceptFamilyInviteHandler(repository);
    const response = await handler({
      inviteToken: 'abc123',
      inviteeMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({error: expect.stringContaining('accepted')});
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('returns 400 when invitee equals payer', async () => {
    const repository = {
      findInviteByToken: jest.fn(async () => pendingInvite),
      acceptInvite: jest.fn(async () => undefined),
    };

    const handler = createAcceptFamilyInviteHandler(repository);
    const response = await handler({
      inviteToken: 'abc123',
      inviteeMatrixUserId: '@alice:sauti.app', // same as payer
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invitee cannot be the same as the payer.',
    });
    expect(repository.acceptInvite).not.toHaveBeenCalled();
  });

  it('returns 400 when request is missing fields', async () => {
    const repository = {
      findInviteByToken: jest.fn(async () => null),
      acceptInvite: jest.fn(async () => undefined),
    };

    const handler = createAcceptFamilyInviteHandler(repository);
    const response = await handler({inviteToken: 'abc123'});

    expect(response.status).toBe(400);
  });
});

// ─── check-family-entitlement ─────────────────────────────────────────────────

describe('check-family-entitlement handler', () => {
  it('allows sender with an active family subscription', async () => {
    const repository = {
      hasActiveFamilySubscription: jest.fn(async (userId: string) =>
        userId === '@alice:sauti.app',
      ),
      hasAcceptedInvite: jest.fn(async () => false),
    };

    const handler = createCheckFamilyEntitlementHandler(repository);
    const response = await handler({
      senderMatrixUserId: '@alice:sauti.app',
      recipientMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({allowed: true});
    expect(repository.hasActiveFamilySubscription).toHaveBeenCalledWith('@alice:sauti.app');
  });

  it('allows sender who was invited by recipient', async () => {
    const repository = {
      hasActiveFamilySubscription: jest.fn(async () => false),
      hasAcceptedInvite: jest.fn(
        async (payer: string, invitee: string) =>
          payer === '@alice:sauti.app' && invitee === '@bob:sauti.app',
      ),
    };

    const handler = createCheckFamilyEntitlementHandler(repository);
    // Bob was invited by Alice → Bob can message Alice
    const response = await handler({
      senderMatrixUserId: '@bob:sauti.app',
      recipientMatrixUserId: '@alice:sauti.app',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({allowed: true});
    expect(repository.hasAcceptedInvite).toHaveBeenCalledWith(
      '@alice:sauti.app',
      '@bob:sauti.app',
    );
  });

  it('denies sender with no subscription and no invite relation', async () => {
    const repository = {
      hasActiveFamilySubscription: jest.fn(async () => false),
      hasAcceptedInvite: jest.fn(async () => false),
    };

    const handler = createCheckFamilyEntitlementHandler(repository);
    const response = await handler({
      senderMatrixUserId: '@carol:sauti.app',
      recipientMatrixUserId: '@bob:sauti.app',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({allowed: false});
  });

  it('returns 400 when fields are missing', async () => {
    const repository = {
      hasActiveFamilySubscription: jest.fn(async () => false),
      hasAcceptedInvite: jest.fn(async () => false),
    };

    const handler = createCheckFamilyEntitlementHandler(repository);
    const response = await handler({senderMatrixUserId: '@alice:sauti.app'});

    expect(response.status).toBe(400);
  });

  it('does not check invite if sender has own subscription (short circuit)', async () => {
    const repository = {
      hasActiveFamilySubscription: jest.fn(async () => true),
      hasAcceptedInvite: jest.fn(async () => false),
    };

    const handler = createCheckFamilyEntitlementHandler(repository);
    await handler({
      senderMatrixUserId: '@alice:sauti.app',
      recipientMatrixUserId: '@bob:sauti.app',
    });

    expect(repository.hasAcceptedInvite).not.toHaveBeenCalled();
  });
});

// ─── FamilyService unit tests ─────────────────────────────────────────────────

jest.mock('../src/core/config/env', () => ({
  readSupabaseEnv: jest.fn(() => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
  })),
}));

describe('FamilyService', () => {
  describe('createInvite', () => {
    it('calls the correct edge function URL and returns parsed result', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          inviteToken: 'tok-abc',
          expiresAt: '2026-04-15T00:00:00.000Z',
          deepLink: 'sauti://invite/tok-abc',
        }),
      })) as unknown as typeof fetch;

      const service = new FamilyService(
        'https://project.supabase.co',
        'anon-key',
        fetchFn,
      );

      const result = await service.createInvite('@alice:sauti.app');

      expect(fetchFn).toHaveBeenCalledWith(
        'https://project.supabase.co/functions/v1/create-family-invite',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({payerMatrixUserId: '@alice:sauti.app'}),
        }),
      );

      expect(result).toMatchObject({
        inviteToken: 'tok-abc',
        expiresAt: '2026-04-15T00:00:00.000Z',
        deepLink: 'sauti://invite/tok-abc',
      });
    });

    it('throws when edge function returns an error status', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({error: 'Only active family plan subscribers can create invites.'}),
      })) as unknown as typeof fetch;

      const service = new FamilyService(
        'https://project.supabase.co',
        'anon-key',
        fetchFn,
      );

      await expect(service.createInvite('@alice:sauti.app')).rejects.toThrow(
        'Only active family plan subscribers can create invites.',
      );
    });
  });

  describe('checkEntitlement', () => {
    it('propagates allowed=true from edge function', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          allowed: true,
          reason: 'sender has an active family subscription',
        }),
      })) as unknown as typeof fetch;

      const service = new FamilyService(
        'https://project.supabase.co',
        'anon-key',
        fetchFn,
      );

      const result = await service.checkEntitlement('@alice:sauti.app', '@bob:sauti.app');

      expect(fetchFn).toHaveBeenCalledWith(
        'https://project.supabase.co/functions/v1/check-family-entitlement',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            senderMatrixUserId: '@alice:sauti.app',
            recipientMatrixUserId: '@bob:sauti.app',
          }),
        }),
      );

      expect(result).toEqual({
        allowed: true,
        reason: 'sender has an active family subscription',
      });
    });

    it('propagates allowed=false (denied) from edge function', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          allowed: false,
          reason: 'sender does not have an active family subscription or accepted invite',
        }),
      })) as unknown as typeof fetch;

      const service = new FamilyService(
        'https://project.supabase.co',
        'anon-key',
        fetchFn,
      );

      const result = await service.checkEntitlement('@carol:sauti.app', '@bob:sauti.app');

      expect(result).toEqual({
        allowed: false,
        reason: 'sender does not have an active family subscription or accepted invite',
      });
    });

    it('throws when edge function returns an error status', async () => {
      const fetchFn = jest.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({error: 'Internal error.'}),
      })) as unknown as typeof fetch;

      const service = new FamilyService(
        'https://project.supabase.co',
        'anon-key',
        fetchFn,
      );

      await expect(
        service.checkEntitlement('@alice:sauti.app', '@bob:sauti.app'),
      ).rejects.toThrow('Internal error.');
    });
  });
});
