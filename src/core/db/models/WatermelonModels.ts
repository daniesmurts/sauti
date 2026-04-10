import {Model} from '@nozbe/watermelondb';

export class RoomModel extends Model {
  static table = 'rooms';
}

export class MessageModel extends Model {
  static table = 'messages';
}

export class OutgoingMessageModel extends Model {
  static table = 'outgoing_messages';
}

export class ContactModel extends Model {
  static table = 'contacts';
}

export const watermelonModelClasses = [
  RoomModel,
  MessageModel,
  OutgoingMessageModel,
  ContactModel,
];
