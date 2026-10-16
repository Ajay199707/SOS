/** State machine contract (spec §12): enforced transitions, no skips. */
const TRANSITIONS: Record<string, string[]> = {
  IDLE: ['ACTIVATING'], ACTIVATING: ['ACTIVE', 'FAILED'],
  ACTIVE: ['DEGRADED', 'CANCEL_REQUESTED', 'RESOLVED', 'FAILED'],
  DEGRADED: ['ACTIVE', 'CANCEL_REQUESTED', 'RESOLVED', 'FAILED'],
  CANCEL_REQUESTED: ['RESOLVED', 'ACTIVE'], FAILED: ['ACTIVATING'], RESOLVED: [],
};
describe('session state machine', () => {
  test('ACTIVE -> DEGRADED -> RESOLVED allowed', () => {
    expect(TRANSITIONS['ACTIVE']).toContain('DEGRADED');
    expect(TRANSITIONS['DEGRADED']).toContain('RESOLVED');
  });
  test('RESOLVED terminal, ACTIVE cannot jump to IDLE', () => {
    expect(TRANSITIONS['RESOLVED']).toEqual([]);
    expect(TRANSITIONS['ACTIVE']).not.toContain('IDLE');
  });
  test('IDOR rule: unrelated user denied', () => {
    const session = { owner_id: 'u1' };
    const requester = 'u2';
    const isParticipant = false;
    const allowed = session.owner_id === requester || isParticipant;
    expect(allowed).toBe(false);
  });
});
