import {resolveChatStartInput} from '../src/modules/main/data/ChatStartResolver';

describe('resolveChatStartInput', () => {
  it('returns existing_room for exact display name match', () => {
    const resolution = resolveChatStartInput('kwame asante', [
      {roomId: '!room-1:sauti.app', displayName: 'Kwame Asante'},
    ]);

    expect(resolution).toEqual({
      kind: 'existing_room',
      roomId: '!room-1:sauti.app',
    });
  });

  it('returns normalized matrix target when valid matrix id is provided', () => {
    const resolution = resolveChatStartInput('  @friend:example.org  ', []);

    expect(resolution).toEqual({
      kind: 'matrix_target',
      target: '@friend:example.org',
    });
  });

  it('returns invalid for unknown plain input', () => {
    const resolution = resolveChatStartInput('not-a-known-contact', []);

    expect(resolution).toEqual({
      kind: 'invalid',
      error: 'No contact match found. Use a full chat ID in Advanced.',
    });
  });

  it('returns existing_room for a unique partial name match', () => {
    const resolution = resolveChatStartInput('kwame', [
      {roomId: '!room-1:sauti.app', displayName: 'Kwame Asante'},
      {roomId: '!room-2:sauti.app', displayName: 'Ama Boateng'},
    ]);

    expect(resolution).toEqual({
      kind: 'existing_room',
      roomId: '!room-1:sauti.app',
    });
  });

  it('returns ambiguous when multiple partial matches exist', () => {
    const resolution = resolveChatStartInput('a', [
      {roomId: '!room-1:sauti.app', displayName: 'Kwame Asante'},
      {roomId: '!room-2:sauti.app', displayName: 'Ama Boateng'},
      {roomId: '!room-3:sauti.app', displayName: 'Amina Diallo'},
    ]);

    expect(resolution).toEqual({
      kind: 'ambiguous',
      matches: [
        {roomId: '!room-1:sauti.app', displayName: 'Kwame Asante'},
        {roomId: '!room-2:sauti.app', displayName: 'Ama Boateng'},
        {roomId: '!room-3:sauti.app', displayName: 'Amina Diallo'},
      ],
    });
  });
});
