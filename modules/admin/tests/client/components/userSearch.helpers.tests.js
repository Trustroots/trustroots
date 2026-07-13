import {
  formatAdminDate,
  getReferenceUserId,
  isExactUserMatch,
  isMongoObjectId,
  isObviousSpamUser,
  isSuspendedUser,
  normalizeAdminQuery,
  resolveExactMemberId,
} from '@/modules/admin/client/components/userSearch.helpers';

describe('admin user search helpers', () => {
  it('normalizes admin queries and validates Mongo object ids', () => {
    expect(normalizeAdminQuery()).toBe('');
    expect(normalizeAdminQuery('  111111111111111111111111  ')).toBe(
      '111111111111111111111111',
    );
    expect(isMongoObjectId('  111111111111111111111111  ')).toBe(true);
    expect(isMongoObjectId('11111111111111111111111z')).toBe(false);
    expect(isMongoObjectId('short-id')).toBe(false);
  });

  it('matches users exactly against selected fields without case sensitivity', () => {
    const user = {
      email: 'alice@example.org',
      emailTemporary: 'alice-new@example.org',
      username: 'alice',
    };

    expect(isExactUserMatch('ALICE', user, ['username'])).toBe(true);
    expect(isExactUserMatch('ALICE@EXAMPLE.ORG', user)).toBe(true);
    expect(isExactUserMatch('alice-new@example.org', user)).toBe(true);
    expect(isExactUserMatch('alice@example.org', user, ['username'])).toBe(
      false,
    );
  });

  it('resolves exact member ids from object ids or searched users', async () => {
    const searchUsers = jest.fn().mockResolvedValue([
      {
        _id: '222222222222222222222222',
        email: 'alice@example.org',
        username: 'alice',
      },
    ]);

    await expect(
      resolveExactMemberId(' 111111111111111111111111 ', searchUsers),
    ).resolves.toBe('111111111111111111111111');
    expect(searchUsers).not.toHaveBeenCalled();

    await expect(
      resolveExactMemberId('ALICE@EXAMPLE.ORG', searchUsers, ['email']),
    ).resolves.toBe('222222222222222222222222');
    expect(searchUsers).toHaveBeenCalledWith('ALICE@EXAMPLE.ORG');
  });

  it('returns an empty exact member id for short or inexact searches', async () => {
    const searchUsers = jest.fn().mockResolvedValue([
      {
        _id: '222222222222222222222222',
        username: 'bob',
      },
    ]);

    await expect(resolveExactMemberId('ab', searchUsers)).resolves.toBe('');
    expect(searchUsers).not.toHaveBeenCalled();

    await expect(resolveExactMemberId('alice', searchUsers)).resolves.toBe('');
    expect(searchUsers).toHaveBeenCalledWith('alice');
  });

  it('keeps date formatting and spam filtering behavior stable', () => {
    expect(formatAdminDate(new Date('2024-01-15T12:00:00.000Z'))).toBe(
      '2024-01-15',
    );
    expect(formatAdminDate('2024-02-03T04:05:06.000Z')).toBe('2024-02-03');
    expect(formatAdminDate()).toBe('');
    expect(
      isObviousSpamUser({
        displayName: 'Hot Daria Wants To Date',
        email: 'spam@example.org',
        emailTemporary: 'spam@example.org',
        public: false,
        roles: ['user', 'suspended'],
      }),
    ).toBe(true);
    expect(
      isObviousSpamUser({
        displayName: 'Alice Example',
        public: true,
        roles: ['user'],
      }),
    ).toBe(false);
    expect(isObviousSpamUser({})).toBe(false);
    expect(
      isObviousSpamUser({
        displayName: 'http://example.invalid/profile',
      }),
    ).toBe(true);
    expect(
      isObviousSpamUser({
        displayName: 'Alice Example',
        public: true,
        roles: ['suspended'],
      }),
    ).toBe(false);
    expect(
      isObviousSpamUser({
        displayName: 'Hot springs volunteer',
      }),
    ).toBe(false);
  });

  it('returns populated or raw reference user ids', () => {
    expect(
      getReferenceUserId(
        { userFrom: { _id: '111111111111111111111111' } },
        'userFrom',
      ),
    ).toBe('111111111111111111111111');
    expect(
      getReferenceUserId({ userFrom: '222222222222222222222222' }, 'userFrom'),
    ).toBe('222222222222222222222222');
    expect(getReferenceUserId({}, 'userFrom')).toBeUndefined();
  });

  it('detects suspended users', () => {
    expect(
      isSuspendedUser({
        roles: ['user', 'suspended'],
      }),
    ).toBe(true);
    expect(
      isSuspendedUser({
        profile: {
          roles: ['user', 'suspended'],
        },
      }),
    ).toBe(true);
    expect(isSuspendedUser({ roles: ['user', 'volunteer'] })).toBe(false);
  });
});
