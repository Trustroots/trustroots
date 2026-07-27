const should = require('should');

const mobileMember = require('../../server/presenters/mobile-member.server.presenter');

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
    should.not.exist(member.password);
    should.not.exist(member.roles);
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
          avatarUploaded: true,
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
        avatarUploaded: true,
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
        avatarUploaded: false,
        member: [{ tribe: { id: 'circle-id', label: 'Circle' } }],
      });
  });

  it('does not expose account details to another member', function () {
    const profile = mobileMember.profile(
      {
        _id: 'profile-id',
        username: 'mobile_member',
        email: 'mobile.member@example.org',
        emailTemporary: 'new.mobile.member@example.org',
        newsletter: true,
      },
      {
        _id: 'viewer-id',
        roles: ['user'],
      },
    );

    profile.should.not.have.property('email');
    should.not.exist(profile.emailTemporary);
    should.not.exist(profile.newsletter);
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

    profile.should.not.have.property('email');
  });

  it('allows an admin to view account details', function () {
    mobileMember
      .profile(
        {
          _id: 'profile-id',
          username: 'mobile_member',
          email: 'mobile.member@example.org',
        },
        {
          _id: 'admin-id',
          roles: ['admin'],
        },
      )
      .email.should.equal('mobile.member@example.org');
  });

  it('uses an empty membership list when the profile has none', function () {
    mobileMember
      .profile({ username: 'mobile_member' })
      .member.should.deepEqual([]);
  });
});
