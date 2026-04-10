import {sautiDbSchema} from '../src/core/db';

describe('sautiDbSchema', () => {
  it('contains required core tables for rooms, messages, outgoing queue, and contacts', () => {
    const schemaAny = sautiDbSchema as unknown as {
      tables?: Record<string, unknown>;
    };

    expect(schemaAny.tables).toBeDefined();
    expect(schemaAny.tables?.rooms).toBeDefined();
    expect(schemaAny.tables?.messages).toBeDefined();
    expect(schemaAny.tables?.outgoing_messages).toBeDefined();
    expect(schemaAny.tables?.contacts).toBeDefined();
  });
});
