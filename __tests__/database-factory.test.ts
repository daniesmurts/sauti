jest.mock('@nozbe/watermelondb', () => {
  const actual = jest.requireActual('@nozbe/watermelondb');
  return {
    ...actual,
    Database: jest.fn().mockImplementation(config => ({
      kind: 'db',
      config,
    })),
  };
});

jest.mock('@nozbe/watermelondb/adapters/sqlite', () =>
  jest.fn().mockImplementation(config => ({
    kind: 'adapter',
    config,
  })),
);

import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import {createSautiDatabase} from '../src/core/db';

describe('createSautiDatabase', () => {
  it('builds Watermelon database with schema, migrations and model classes', () => {
    const db = createSautiDatabase({dbName: 'sauti-test'});

    expect(SQLiteAdapter).toHaveBeenCalledTimes(1);
    expect((SQLiteAdapter as unknown as jest.Mock).mock.calls[0][0]).toMatchObject({
      dbName: 'sauti-test',
      jsi: true,
    });

    expect(Database).toHaveBeenCalledTimes(1);
    expect((Database as unknown as jest.Mock).mock.calls[0][0]).toHaveProperty(
      'modelClasses',
    );

    expect(db).toMatchObject({kind: 'db'});
  });
});
