import { getAdminMessagesHref } from '@/modules/admin/client/utils/member-url';

describe('getAdminMessagesHref', () => {
  it('uses usernames when they are known', () => {
    expect(
      getAdminMessagesHref(
        { _id: 'member-1', username: 'alice' },
        { _id: 'member-2', username: 'bob' },
      ),
    ).toBe('/admin/messages?username1=alice&username2=bob');
  });

  it('falls back to IDs for deleted or unknown members', () => {
    expect(getAdminMessagesHref('member-1', { _id: 'member-2' })).toBe(
      '/admin/messages?userId1=member-1&userId2=member-2',
    );
  });

  it('supports mixed usernames and IDs and encodes identifiers', () => {
    expect(
      getAdminMessagesHref(
        { _id: 'member-1', username: 'alice example' },
        'member/2',
      ),
    ).toBe('/admin/messages?username1=alice%20example&userId2=member%2F2');
  });

  it('returns no link when a member has no usable identifier', () => {
    expect(getAdminMessagesHref({ _id: 'member-1' }, undefined)).toBeNull();
  });
});
