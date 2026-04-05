import {schemaMigrations} from '@nozbe/watermelondb/Schema/migrations';

// Version 1 is represented by schema.ts; no post-v1 migrations yet.
export const sautiDbMigrations = schemaMigrations({
  migrations: [],
});
