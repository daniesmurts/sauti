import {appSchema, tableSchema} from '@nozbe/watermelondb';

export const sautiDbSchema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'rooms',
      columns: [
        {name: 'name', type: 'string', isOptional: true},
        {name: 'topic', type: 'string', isOptional: true},
        {name: 'is_direct', type: 'boolean'},
        {name: 'last_event_at', type: 'number', isOptional: true},
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        {name: 'local_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'matrix_event_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'room_id', type: 'string', isIndexed: true},
        {name: 'sender_id', type: 'string', isIndexed: true},
        {name: 'body', type: 'string'},
        {name: 'msg_type', type: 'string'},
        {name: 'status', type: 'string', isIndexed: true},
        {name: 'timestamp', type: 'number', isIndexed: true},
        {name: 'is_read', type: 'boolean'},
      ],
    }),
    tableSchema({
      name: 'outgoing_messages',
      columns: [
        {name: 'local_id', type: 'string', isIndexed: true},
        {name: 'room_id', type: 'string', isIndexed: true},
        {name: 'body', type: 'string'},
        {name: 'status', type: 'string', isIndexed: true},
        {name: 'attempts', type: 'number'},
        {name: 'next_attempt_at', type: 'number', isIndexed: true},
        {name: 'matrix_event_id', type: 'string', isOptional: true},
        {name: 'last_error', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number', isIndexed: true},
        {name: 'updated_at', type: 'number'},
      ],
    }),
    tableSchema({
      name: 'contacts',
      columns: [
        {name: 'display_name', type: 'string', isIndexed: true},
        {name: 'matrix_user_id', type: 'string', isOptional: true, isIndexed: true},
        {name: 'phone_number', type: 'string', isOptional: true, isIndexed: true},
        {name: 'source', type: 'string', isOptional: true, isIndexed: true},
        {name: 'last_message', type: 'string', isOptional: true},
        {name: 'is_online', type: 'boolean'},
        {name: 'updated_at', type: 'number', isIndexed: true},
      ],
    }),
  ],
});
