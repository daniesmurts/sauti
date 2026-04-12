import {parseMatrixConversationTarget} from './MatrixConversationTarget';

export interface ChatStartConversationCandidate {
  roomId: string;
  displayName: string;
}

export interface ChatStartAmbiguousMatch {
  roomId: string;
  displayName: string;
}

export type ChatStartResolution =
  | {
      kind: 'existing_room';
      roomId: string;
    }
  | {
      kind: 'ambiguous';
      matches: ChatStartAmbiguousMatch[];
    }
  | {
      kind: 'matrix_target';
      target: string;
    }
  | {
      kind: 'invalid';
      error: string;
    };

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveChatStartInput(
  input: string,
  conversations: ChatStartConversationCandidate[],
): ChatStartResolution {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      kind: 'invalid',
      error: 'Enter a name, phone, or chat ID.',
    };
  }

  const exactRoomMatch = conversations.find(conversation => conversation.roomId === trimmed);
  if (exactRoomMatch) {
    return {
      kind: 'existing_room',
      roomId: exactRoomMatch.roomId,
    };
  }

  const normalizedInput = normalize(trimmed);
  const matchingConversation = conversations.find(
    conversation => normalize(conversation.displayName) === normalizedInput,
  );

  if (matchingConversation) {
    return {
      kind: 'existing_room',
      roomId: matchingConversation.roomId,
    };
  }

  const partialMatches = conversations.filter(conversation =>
    normalize(conversation.displayName).includes(normalizedInput),
  );

  if (partialMatches.length === 1) {
    return {
      kind: 'existing_room',
      roomId: partialMatches[0].roomId,
    };
  }

  if (partialMatches.length > 1) {
    return {
      kind: 'ambiguous',
      matches: partialMatches.slice(0, 3).map(match => ({
        roomId: match.roomId,
        displayName: match.displayName,
      })),
    };
  }

  const parsed = parseMatrixConversationTarget(trimmed);
  if (!parsed.ok) {
    return {
      kind: 'invalid',
      error: 'No contact match found. Use a full chat ID in Advanced.',
    };
  }

  return {
    kind: 'matrix_target',
    target: parsed.target.normalized,
  };
}
