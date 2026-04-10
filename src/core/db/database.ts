import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {
  createWatermelonContactDirectoryStore,
  createWatermelonMessageStatusStore,
  createWatermelonMessageTimelineStore,
  createWatermelonOutgoingMessageCollection,
  createWatermelonRoomDirectoryStore,
  WatermelonContactDirectoryStore,
  WatermelonMessageStatusStore,
  WatermelonMessageTimelineStore,
  WatermelonQueueMessageStore,
  WatermelonRoomDirectoryStore,
} from './repositories';
import {watermelonModelClasses} from './models';
import {sautiDbSchema} from './schema';
import {sautiDbMigrations} from './migrations';

export interface SautiDatabaseFactoryOptions {
  dbName?: string;
}

export function createSautiDatabase(
  options: SautiDatabaseFactoryOptions = {},
): Database {
  const adapter = new SQLiteAdapter({
    dbName: options.dbName ?? 'sauti',
    schema: sautiDbSchema,
    migrations: sautiDbMigrations,
    jsi: true,
  });

  return new Database({
    adapter,
    modelClasses: watermelonModelClasses,
  });
}

export function createWatermelonQueueStore(database: Database): WatermelonQueueMessageStore {
  const outboxCollection = createWatermelonOutgoingMessageCollection(database);
  return new WatermelonQueueMessageStore(outboxCollection);
}

export function createWatermelonMessageStore(database: Database): WatermelonMessageStatusStore {
  return createWatermelonMessageStatusStore(database);
}

export function createWatermelonTimelineStore(database: Database): WatermelonMessageTimelineStore {
  return createWatermelonMessageTimelineStore(database);
}

export function createWatermelonRoomStore(database: Database): WatermelonRoomDirectoryStore {
  return createWatermelonRoomDirectoryStore(database);
}

export function createWatermelonContactStore(database: Database): WatermelonContactDirectoryStore {
  return createWatermelonContactDirectoryStore(database);
}
