import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Colors} from '../tokens/colors';
import {Radius, Spacing} from '../tokens/spacing';
import {FontSize} from '../tokens/typography';
import {VoiceNotePlayer} from './VoiceNotePlayer';
import {InlineImage} from './InlineImage';

export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface VoiceNoteContent {
  uri: string;
  durationMs: number;
}

export interface ImageContent {
  uri: string;
  width: number;
  height: number;
  /** Pass false to show a download gate (e.g. on cellular when wifi_only is set). */
  autoDownload?: boolean;
}

export interface MessageBubbleProps {
  text: string;
  direction: MessageDirection;
  timestamp: string;
  status?: MessageStatus;
  voiceNote?: VoiceNoteContent;
  image?: ImageContent;
  testID?: string;
}

const STATUS_SYMBOL: Record<MessageStatus, string> = {
  sending: '○',     // open circle — pending
  sent: '✓',        // single tick
  delivered: '✓✓',  // double tick
  read: '✓✓',       // double tick (styled blue separately)
};

export function MessageBubble({
  text,
  direction,
  timestamp,
  status,
  voiceNote,
  image,
  testID,
}: MessageBubbleProps): React.JSX.Element {
  const isOutgoing = direction === 'outgoing';

  return (
    <View
      testID={testID}
      style={[styles.wrapper, isOutgoing ? styles.wrapperOut : styles.wrapperIn]}>
      <View style={[styles.bubble, isOutgoing ? styles.bubbleOut : styles.bubbleIn]}>
        {voiceNote ? (
          <VoiceNotePlayer
            uri={voiceNote.uri}
            durationMs={voiceNote.durationMs}
            direction={direction}
          />
        ) : image ? (
          <InlineImage
            uri={image.uri}
            width={image.width}
            height={image.height}
            autoDownload={image.autoDownload}
          />
        ) : (
          <Text style={[styles.text, isOutgoing ? styles.textOut : styles.textIn]}>
            {text}
          </Text>
        )}

        <View style={styles.meta}>
          <Text style={[styles.timestamp, isOutgoing ? styles.timestampOut : styles.timestampIn]}>
            {timestamp}
          </Text>

          {isOutgoing && status ? (
            <Text
              style={[
                styles.status,
                status === 'read' && styles.statusRead,
              ]}>
              {STATUS_SYMBOL[status]}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: Spacing.xxs,
    marginHorizontal: Spacing.sm,
    maxWidth: '75%',
  },
  wrapperOut: {
    alignSelf: 'flex-end',
  },
  wrapperIn: {
    alignSelf: 'flex-start',
  },

  bubble: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bubbleOut: {
    backgroundColor: Colors.message.outgoing,
    borderBottomRightRadius: Radius.xs,
  },
  bubbleIn: {
    backgroundColor: Colors.message.incoming,
    borderBottomLeftRadius: Radius.xs,
  },

  text: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  textOut: {color: Colors.message.outgoingText},
  textIn: {color: Colors.message.incomingText},

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.xxs,
    gap: Spacing.xs,
  },
  timestamp: {fontSize: FontSize.xs},
  timestampOut: {color: 'rgba(255,255,255,0.7)'},
  timestampIn: {color: Colors.neutral[500]},

  status: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  statusRead: {
    color: '#93C5FD', // blue-300 — read receipts rendered in blue
  },
});
