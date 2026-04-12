import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

export const sautiDbMigrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        {
          type: 'create_table',
          schema: {
            name: 'contacts',
            columns: [
              {name: 'display_name', type: 'string', isIndexed: true},
              {name: 'last_message', type: 'string', isOptional: true},
              {name: 'is_online', type: 'boolean'},
              {name: 'updated_at', type: 'number', isIndexed: true},
            ],
          },
        },
      ],
    },
    {
      toVersion: 3,
      steps: [
        {
          type: 'add_columns',
          table: 'contacts',
          columns: [
            {name: 'matrix_user_id', type: 'string', isOptional: true, isIndexed: true},
            {name: 'phone_number', type: 'string', isOptional: true, isIndexed: true},
            {name: 'source', type: 'string', isOptional: true, isIndexed: true},
          ],
        },
      ],
    },
  ],
});
