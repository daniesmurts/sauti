import {sautiDbSchema} from '../src/core/db';

describe('sautiDbSchema', () => {
  it('contains required core tables for rooms, messages, outgoing queue, and enriched contacts', () => {
    const schemaAny = sautiDbSchema as unknown as {
      version?: number;
      tables?: Record<string, {columns?: Record<string, unknown>}>;
    };

    expect(schemaAny.version).toBe(3);
    expect(schemaAny.tables).toBeDefined();
    expect(schemaAny.tables?.rooms).toBeDefined();
    expect(schemaAny.tables?.messages).toBeDefined();
    expect(schemaAny.tables?.outgoing_messages).toBeDefined();
    expect(schemaAny.tables?.contacts).toBeDefined();
    expect(schemaAny.tables?.contacts.columns?.matrix_user_id).toBeDefined();
    expect(schemaAny.tables?.contacts.columns?.phone_number).toBeDefined();
    expect(schemaAny.tables?.contacts.columns?.source).toBeDefined();
  });
});
