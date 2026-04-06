import React from 'react';
import {FlatList, StyleSheet, Text, TextInput, View} from 'react-native';

import {useScreenCaptureProtection} from '../../../core/security/screenCaptureProtection';
import {Avatar, Button, MessageBubble, Screen} from '../../../ui/components';
import {Colors, Radius, Spacing, TextPresets} from '../../../ui/tokens';

export interface ChatMessage {
  id: string;
  text: string;
  direction: 'incoming' | 'outgoing';
  timestampLabel: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface ChatRoom {
  roomId: string;
  displayName: string;
  isOnline: boolean;
}

export interface ChatRoomScreenProps {
  room: ChatRoom;
  messages: ChatMessage[];
  draftMessage: string;
  onBack(): void;
  onDraftChange(value: string): void;
  onSend(): void;
}

export function ChatRoomScreen({
  room,
  messages,
  draftMessage,
  onBack,
  onDraftChange,
  onSend,
}: ChatRoomScreenProps): React.JSX.Element {
  useScreenCaptureProtection(true);

  return (
    <Screen>
      <View style={styles.header}>
        <Button label="Back" variant="ghost" size="sm" onPress={onBack} />
        <Avatar name={room.displayName} size="sm" />
        <View style={styles.headerBody}>
          <Text style={styles.roomName}>{room.displayName}</Text>
          <Text style={styles.roomStatus}>
            {room.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesContent}
        renderItem={({item}) => (
          <MessageBubble
            text={item.text}
            direction={item.direction}
            timestamp={item.timestampLabel}
            status={item.status}
          />
        )}
      />

      <View style={styles.inputBar}>
        <TextInput
          accessibilityLabel="message-input"
          value={draftMessage}
          onChangeText={onDraftChange}
          style={styles.input}
          placeholder="Write a message"
          placeholderTextColor={Colors.neutral[400]}
          multiline
          maxLength={1000}
        />
        <Button
          label="Send"
          size="sm"
          onPress={onSend}
          disabled={draftMessage.trim().length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  headerBody: {
    gap: Spacing.xxs,
  },
  roomName: {
    ...TextPresets.body,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  roomStatus: {
    ...TextPresets.label,
    color: Colors.neutral[500],
  },
  messagesContent: {
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.neutral[900],
    backgroundColor: Colors.neutral[0],
    ...TextPresets.body,
  },
});
