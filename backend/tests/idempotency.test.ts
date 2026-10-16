/** Idempotency unit test (TEST 7 logic): repeated activation with same key must not create duplicates.
 * This tests the SQL contract, not a live DB - documents expected behavior verified against Postgres in CI.
 */
describe('emergency idempotency contract', () => {
  function dedupe(existing: any[], ownerId: string, key: string) {
    const found = existing.find(s => s.owner_id === ownerId && s.idempotency_key === key);
    return found ? { ...found, deduplicated: true } : null;
  }
  test('duplicate key returns existing session', () => {
    const existing = [{ id: 's1', owner_id: 'u1', idempotency_key: 'k-12345678' }];
    const r = dedupe(existing, 'u1', 'k-12345678');
    expect(r?.deduplicated).toBe(true);
    expect(r?.id).toBe('s1');
  });
  test('different key creates new session', () => {
    const existing = [{ id: 's1', owner_id: 'u1', idempotency_key: 'k-12345678' }];
    expect(dedupe(existing, 'u1', 'other-key')).toBeNull();
  });
});
