import {parseMatrixConversationTarget} from '../src/modules/main';

describe('parseMatrixConversationTarget', () => {
  it('accepts matrix user id', () => {
    const parsed = parseMatrixConversationTarget('@friend:example.org');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.target.kind).toBe('user_id');
    expect(parsed.target.normalized).toBe('@friend:example.org');
  });

  it('accepts room alias and room id', () => {
    const alias = parseMatrixConversationTarget('#campus:example.org');
    const roomId = parseMatrixConversationTarget('!abc123:example.org');

    expect(alias.ok).toBe(true);
    expect(roomId.ok).toBe(true);

    if (alias.ok) {
      expect(alias.target.kind).toBe('room_alias');
    }

    if (roomId.ok) {
      expect(roomId.target.kind).toBe('room_id');
    }
  });

  it('rejects invalid input with clear message', () => {
    const parsed = parseMatrixConversationTarget('friend-at-example');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }

    expect(parsed.error).toBe(
      'Use @user:server, #room:server, or !room:server format.',
    );
  });
});
