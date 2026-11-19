import should from 'should';

import mobileMember from '../../server/presenters/mobile-member.server.presenter.cjs';

describe('Mobile member presenter', function () {
  it('returns only the stable current-member fields', function () {
    const member = mobileMember.currentMember({
      _id: 'member-id',
      username: 'mobile_member',
      displayName: 'Mobile Member',
      public: true,
      email: 'mobile.member@example.org',
      newsletter: true,
      password: 'must-not-leak',
      roles: ['admin'],
    });

    member.should.deepEqual({
      id: 'member-id',
      username: 'mobile_member',
      displayName: 'Mobile Member',
      public: true,
      email: 'mobile.member@example.org',
      newsletter: true,
    });
    should.not.exist((member as Record<string, unknown>).password);
    should.not.exist((member as Record<string, unknown>).roles);
  });

  it('uses safe defaults for optional presentation fields', function () {
    mobileMember
      .currentMember({
        id: 'fallback-id',
        username: 'mobile_member',
        email: 'mobile.member@example.org',
      })
      .should.deepEqual({
        id: 'fallback-id',
        username: 'mobile_member',
        displayName: 'mobile_member',
        public: false,
        email: 'mobile.member@example.org',
        newsletter: false,
      });
  });

  it('uses an empty identifier only when no identifier exists', function () {
    mobileMember
      .currentMember({ username: 'mobile_member' })
      .id.should.equal('');
  });

  it('returns the stable native profile fields and circle summaries', function () {
    const created = new Date('2026-07-16T12:00:00.000Z');
    mobileMember
      .profile(
        {
          _id: 'profile-id',
          username: 'mobile_member',
          displayName: 'Mobile Member',
          tagline: 'A short introduction',
          description: 'About this member',
          locationLiving: 'Example City',
          locationFrom: 'Sample Town',
          languages: ['eng'],
          created,
          seen: created,
          replyRate: '82%',
          replyTime: '4 hours',
          avatarUploaded: true,
          nostrNpub: 'npub1example',
          email: 'mobile.member@example.org',
          emailTemporary: 'new.mobile.member@example.org',
          newsletter: true,
          member: [{ tribe: { _id: 'circle-id', label: 'Example Circle' } }],
          roles: ['admin'],
          password: 'must-not-leak',
        },
        {
          _id: 'profile-id',
          roles: ['user'],
        },
      )
      .should.deepEqual({
        id: 'profile-id',
        username: 'mobile_member',
        displayName: 'Mobile Member',
        tagline: 'A short introduction',
        description: 'About this member',
        locationLiving: 'Example City',
        locationFrom: 'Sample Town',
        languages: ['eng'],
        created,
        seen: created,
        replyRate: '82%',
        replyTime: '4 hours',
        avatarUploaded: true,
        nostrNpub: 'npub1example',
        email: 'mobile.member@example.org',
        emailTemporary: 'new.mobile.member@example.org',
        newsletter: true,
        member: [{ tribe: { id: 'circle-id', label: 'Example Circle' } }],
      });
  });

  it('uses safe profile defaults and removes missing circle references', function () {
    mobileMember
      .profile({
        id: 'fallback-id',
        username: 'mobile_member',
        member: [null, {}, { tribe: { id: 'circle-id' } }],
      })
      .should.deepEqual({
        id: 'fallback-id',
        username: 'mobile_member',
        displayName: 'mobile_member',
        tagline: null,
        description: null,
        locationLiving: null,
        locationFrom: null,
        languages: [],
        created: null,
        seen: null,
        replyRate: null,
        replyTime: null,
        avatarUploaded: false,
        member: [{ tribe: { id: 'circle-id', label: 'Circle' } }],
      });
  });

  it('retains circle links and artwork while excluding unrelated fields', function () {
    const circle = {
      id: 'circle-id',
      label: 'Example Circle',
      slug: 'example-circle',
      description: 'A fictional circle',
      count: 0,
      image: false,
      color: '#123456',
    };
    const profile = mobileMember.profile({
      username: 'examplemember',
      member: [
        { tribe: { ...circle, internalNote: 'private' } },
        { tribe: { id: 'missing-artwork', slug: null } },
      ],
    });

    profile.member.should.deepEqual([
      { tribe: circle },
      { tribe: { id: 'missing-artwork', label: 'Circle' } },
    ]);
  });

  it('does not expose account details to another member', function () {
    const profile = mobileMember.profile(
      {
        _id: 'profile-id',
        username: 'mobile_member',
        email: 'mobile.member@example.org',
        emailTemporary: 'new.mobile.member@example.org',
        newsletter: true,
        nostrNpub: 'npub1example',
      },
      {
        _id: 'viewer-id',
        roles: ['user'],
      },
    );

    profile.should.not.have.property('nostrNpub');
    profile.should.not.have.property('email');
    should.not.exist((profile as Record<string, unknown>).emailTemporary);
    should.not.exist((profile as Record<string, unknown>).newsletter);
  });

  it("does not require roles to keep another member's account details private", function () {
    const profile = mobileMember.profile(
      {
        _id: 'profile-id',
        username: 'mobile_member',
        email: 'mobile.member@example.org',
      },
      { _id: 'viewer-id' },
    );

    profile.should.not.have.property('nostrNpub');
    profile.should.not.have.property('email');
  });

  it('allows an admin to view account details', function () {
    const profile = mobileMember.profile(
      {
        _id: 'profile-id',
        username: 'mobile_member',
        email: 'mobile.member@example.org',
      },
      {
        _id: 'admin-id',
        roles: ['admin'],
      },
    );
    profile.should.have.property('nostrNpub', null);
    (profile as { email?: string }).email!.should.equal(
      'mobile.member@example.org',
    );
  });

  it('returns a linked Nostr key to an administrator', function () {
    mobileMember
      .profile(
        {
          _id: 'profile-id',
          username: 'mobile_member',
          nostrNpub: 'npub1example',
        },
        { _id: 'admin-id', roles: ['admin'] },
      )
      .should.have.property('nostrNpub', 'npub1example');
  });

  it('returns an explicit null for an unlinked own-profile key', function () {
    for (const nostrNpub of [undefined, null, '']) {
      mobileMember
        .profile(
          { _id: 'profile-id', username: 'mobile_member', nostrNpub },
          { _id: 'profile-id', roles: ['user'] },
        )
        .should.have.property('nostrNpub', null);
    }
  });

  it('uses an empty membership list when the profile has none', function () {
    mobileMember
      .profile({ username: 'mobile_member' })
      .member.should.deepEqual([]);
  });
});
