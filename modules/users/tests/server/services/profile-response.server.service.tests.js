require('should');
const {
  profileQueryFields,
  selectProfileUpdateFields,
  selectProfileResponse,
  selectMiniProfileResponse,
} = require('./../../../server/services/profile-response.server.service.cjs');

describe('Service: profile-response', function () {
  let esmService;

  before(async function () {
    esmService = await import(
      '../../../server/services/profile-response.server.service.mjs'
    );
  });

  it('exposes the same service functions through ESM and CommonJS', function () {
    esmService.profileQueryFields.should.equal(profileQueryFields);
    esmService.selectProfileUpdateFields.should.equal(
      selectProfileUpdateFields,
    );
    esmService.selectProfileResponse.should.equal(selectProfileResponse);
    esmService.selectMiniProfileResponse.should.equal(
      selectMiniProfileResponse,
    );
  });

  const profile = {
    _id: 'fictional-user-id',
    username: 'fictional-member',
    displayName: 'Fictional Member',
    firstName: 'Fictional',
    lastName: 'Member',
    email: 'member@example.test',
    emailTemporary: 'pending@example.test',
    newsletter: true,
    locale: 'en',
    provider: 'local',
    blocked: ['fictional-blocked-id'],
    usernameUpdated: new Date('2025-01-01T00:00:00.000Z'),
    usernameUpdateAllowed: true,
    updated: new Date('2025-01-02T00:00:00.000Z'),
    passwordUpdated: new Date('2025-01-03T00:00:00.000Z'),
    avatarVersion: '0123456789abcdef0123456789abcdef',
    lastIpAddress: '192.0.2.1',
    pushRegistration: [{ token: 'fictional-push-token' }],
    providerData: [{ accessToken: 'fictional-provider-token' }],
    futurePrivateField: 'must stay private',
    additionalProvidersData: {
      facebook: { id: 'fictional-facebook-id', accessToken: 'private' },
    },
  };

  it('queries only the approved public profile fields', function () {
    esmService.profileQueryFields.should.containEql(
      'additionalProvidersData.facebook.id',
    );
    esmService.profileQueryFields.should.containEql('avatarVersion');
    esmService.profileQueryFields.should.not.containEql('lastIpAddress');
    esmService.profileQueryFields.should.not.containEql('pushRegistration');
  });

  it('selects only persisted profile update fields and leaves email to its flow', function () {
    selectProfileUpdateFields({
      firstName: 'Fictional',
      newsletter: false,
      email: 'member@example.test',
      emailTemporary: 'pending@example.test',
      providerData: { accessToken: 'private' },
    }).should.deepEqual({ firstName: 'Fictional', newsletter: false });

    selectProfileUpdateFields({ description: undefined }).should.have.property(
      'description',
    );
  });

  it('returns only public fields for another member', function () {
    const response = esmService.selectProfileResponse(profile, false);

    response.username.should.equal('fictional-member');
    response.avatarVersion.should.equal('0123456789abcdef0123456789abcdef');
    response.additionalProvidersData.facebook.id.should.equal(
      'fictional-facebook-id',
    );
    for (const field of [
      'email',
      'emailTemporary',
      'newsletter',
      'locale',
      'provider',
      'blocked',
      'usernameUpdated',
      'usernameUpdateAllowed',
      'updated',
      'passwordUpdated',
      'lastIpAddress',
      'pushRegistration',
      'providerData',
      'futurePrivateField',
    ]) {
      (response[field] === undefined).should.be.true();
    }
  });

  it('keeps account-editing fields for the account holder only', function () {
    const response = esmService.selectProfileResponse(profile, true);
    response.avatarVersion.should.equal('0123456789abcdef0123456789abcdef');

    for (const field of [
      'firstName',
      'lastName',
      'email',
      'emailTemporary',
      'newsletter',
      'locale',
      'provider',
      'blocked',
      'usernameUpdated',
      'usernameUpdateAllowed',
    ]) {
      response[field].should.not.be.undefined();
    }
    (response.futurePrivateField === undefined).should.be.true();
    (response.lastIpAddress === undefined).should.be.true();
    (response.pushRegistration === undefined).should.be.true();
    (response.providerData === undefined).should.be.true();
  });

  it('returns only the approved mini-profile identity fields', function () {
    const mini = selectMiniProfileResponse({
      _id: 'fictional-user-id',
      id: 'fictional-user-id',
      username: 'fictional-member',
      displayName: 'Fictional Member',
      avatarSource: 'gravatar',
      avatarUploaded: false,
      avatarVersion: '0123456789abcdef0123456789abcdef',
      emailHash: 'fictional-hash',
      additionalProvidersData: {
        facebook: { id: 'fictional-facebook-id', accessToken: 'private' },
      },
      public: true,
      roles: ['admin'],
      blocked: ['fictional-blocked-id'],
      email: 'member@example.test',
      futureField: 'must stay private',
    });

    mini.username.should.equal('fictional-member');
    mini.additionalProvidersData.facebook.id.should.equal(
      'fictional-facebook-id',
    );
    (
      mini.additionalProvidersData.facebook.accessToken === undefined
    ).should.be.true();
    for (const field of ['public', 'roles', 'email', 'futureField']) {
      (mini[field] === undefined).should.be.true();
    }
    mini.blocked.should.deepEqual(['fictional-blocked-id']);
  });
});
