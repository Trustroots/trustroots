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

type SearchUser = Parameters<typeof isExactUserMatch>[1] & { _id: string };
type SearchUsers = Parameters<typeof resolveExactMemberId>[1];

const searchUsers = (
  ...users: SearchUser[]
): jest.MockedFunction<SearchUsers> => jest.fn().mockResolvedValue(users);

const candidate = (overrides: Partial<SearchUser> = {}): SearchUser => ({
  _id: '111111111111111111111111',
  ...overrides,
});

describe('admin user search helpers', () => {
  it('normalizes admin queries and validates Mongo object ids', () => {
    expect(normalizeAdminQuery(undefined)).toBe('');
    expect(normalizeAdminQuery('  111111111111111111111111  ')).toBe(
      '111111111111111111111111',
    );
    expect(isMongoObjectId('  111111111111111111111111  ')).toBe(true);
    expect(isMongoObjectId('11111111111111111111111z')).toBe(false);
    expect(isMongoObjectId('short-id')).toBe(false);
  });

  it('matches users exactly against selected fields without case sensitivity', () => {
    // This helper only reads the selected fields, so keep its minimal candidate.
    const user = {
      email: 'member@example.test',
      emailTemporary: 'member-new@example.test',
      username: 'member-one',
    } as NonNullable<Parameters<typeof isExactUserMatch>[1]>;

    expect(isExactUserMatch('MEMBER-ONE', user, ['username'])).toBe(true);
    expect(isExactUserMatch('MEMBER@EXAMPLE.TEST', user)).toBe(true);
    expect(isExactUserMatch('member-new@example.test', user)).toBe(true);
    expect(isExactUserMatch('member@example.test', user, ['username'])).toBe(
      false,
    );
  });

  it('resolves exact member ids from object ids or searched users', async () => {
    const users = searchUsers(
      candidate({
        _id: '222222222222222222222222',
        email: 'member@example.test',
        username: 'member-one',
      }),
    );

    await expect(
      resolveExactMemberId(' 111111111111111111111111 ', users),
    ).resolves.toBe('111111111111111111111111');
    expect(users).not.toHaveBeenCalled();

    await expect(
      resolveExactMemberId('MEMBER@EXAMPLE.TEST', users, ['email']),
    ).resolves.toBe('222222222222222222222222');
    expect(users).toHaveBeenCalledWith('MEMBER@EXAMPLE.TEST');
  });

  it('returns an empty exact member id for short or inexact searches', async () => {
    const users = searchUsers(
      candidate({
        _id: '222222222222222222222222',
        username: 'other-member',
      }),
    );

    await expect(resolveExactMemberId('ab', users)).resolves.toBe('');
    expect(users).not.toHaveBeenCalled();

    await expect(resolveExactMemberId('member-one', users)).resolves.toBe('');
    expect(users).toHaveBeenCalledWith('member-one');
  });

  it('keeps date formatting and spam filtering behavior stable', () => {
    expect(formatAdminDate(new Date('2024-01-15T12:00:00.000Z'))).toBe(
      '2024-01-15',
    );
    expect(formatAdminDate('2024-02-03T04:05:06.000Z')).toBe('2024-02-03');
    expect(formatAdminDate()).toBe('');
    expect(
      isObviousSpamUser(
        candidate({
          displayName: 'Hot Member Wants To Meet',
          email: 'spam@example.test',
          emailTemporary: 'spam@example.test',
          public: false,
          roles: ['user', 'suspended'],
        }),
      ),
    ).toBe(true);
    expect(
      isObviousSpamUser(
        candidate({
          displayName: 'Member One',
          public: true,
          roles: ['user'],
        }),
      ),
    ).toBe(false);
    expect(isObviousSpamUser(candidate())).toBe(false);
    expect(
      isObviousSpamUser(
        candidate({ displayName: 'http://example.invalid/profile' }),
      ),
    ).toBe(true);
    expect(
      isObviousSpamUser(
        candidate({
          displayName: 'Member One',
          public: true,
          roles: ['suspended'],
        }),
      ),
    ).toBe(false);
    expect(
      isObviousSpamUser(candidate({ displayName: 'Hot springs volunteer' })),
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
    expect(isSuspendedUser(candidate({ roles: ['user', 'suspended'] }))).toBe(
      true,
    );
    expect(
      isSuspendedUser(candidate({ profile: { roles: ['user', 'suspended'] } })),
    ).toBe(true);
    expect(isSuspendedUser(candidate({ roles: ['user', 'volunteer'] }))).toBe(
      false,
    );
  });
});
