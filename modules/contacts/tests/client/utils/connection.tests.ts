import {
  memberId,
  contactState,
  connectionAccounts,
} from '../../../client/utils/connection';
import type { ExperienceMine } from '@/modules/experiences/shared/experience';

it('normalises identifiers and contact direction without assigning absence to an existing request', () => {
  expect(memberId()).toBeUndefined();
  expect(memberId('viewer')).toBe('viewer');
  expect(memberId({ _id: 'other' })).toBe('other');
  expect(contactState(null, 'viewer')).toBe('absent');
  expect(contactState({ confirmed: true }, 'viewer')).toBe('confirmed');
  expect(contactState({ userFrom: 'viewer' }, 'viewer')).toBe('outgoing');
  expect(
    contactState(
      { userFrom: { _id: 'other', username: 'rowan', displayName: 'Rowan' } },
      'viewer',
    ),
  ).toBe('incoming');
});
it('preserves privacy omissions and ignores mismatched pairs', () => {
  expect(connectionAccounts(null, 'viewer', 'other')).toEqual({
    yours: null,
    theirs: null,
  });
  const primary: ExperienceMine = {
    _id: 'account',
    created: '2026-01-01',
    public: false,
    userFrom: 'other',
    userTo: 'viewer',
    response: null,
  };
  expect(connectionAccounts(primary, 'viewer', 'other').theirs).toEqual(
    expect.objectContaining({
      authorId: 'other',
      public: false,
      interactions: undefined,
    }),
  );
  expect(connectionAccounts(primary, 'someone-else', 'other')).toEqual({
    yours: null,
    theirs: null,
  });
  expect(
    connectionAccounts(
      { ...primary, userFrom: 'viewer', userTo: 'unrelated' },
      'viewer',
      'other',
    ),
  ).toEqual({ yours: null, theirs: null });
  expect(
    connectionAccounts(
      { ...primary, userFrom: 'viewer', userTo: 'other' },
      'viewer',
      'other',
    ).yours?.id,
  ).toBe('account');
});
