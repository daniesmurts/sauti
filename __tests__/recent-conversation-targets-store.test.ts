import {
  createInMemoryRecentConversationTargetsStore,
} from '../src/modules/main';

describe('RecentConversationTargetsStore', () => {
  it('stores targets in recency order, dedupes, and trims to max', async () => {
    const store = createInMemoryRecentConversationTargetsStore();

    await store.addTarget('@a:example.org');
    await store.addTarget('@b:example.org');
    await store.addTarget('@a:example.org');

    const deduped = await store.listTargets();
    expect(deduped.slice(0, 2)).toEqual(['@a:example.org', '@b:example.org']);

    for (let i = 0; i < 10; i += 1) {
      await store.addTarget(`@user${i}:example.org`);
    }

    const targets = await store.listTargets();

    expect(targets[0]).toBe('@user9:example.org');
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets.length).toBe(8);
  });

  it('removes a target and keeps ordering for remaining items', async () => {
    const store = createInMemoryRecentConversationTargetsStore();

    await store.addTarget('@a:example.org');
    await store.addTarget('@b:example.org');
    await store.addTarget('@c:example.org');

    await store.removeTarget('@b:example.org');

    const targets = await store.listTargets();
    expect(targets).toEqual(['@c:example.org', '@a:example.org']);
  });

  it('clears all stored targets', async () => {
    const store = createInMemoryRecentConversationTargetsStore();

    await store.addTarget('@a:example.org');
    await store.addTarget('@b:example.org');

    await store.clearTargets();

    await expect(store.listTargets()).resolves.toEqual([]);
  });
});
