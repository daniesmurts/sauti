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
  ],
});
