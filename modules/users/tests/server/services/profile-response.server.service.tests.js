require('should');
const {
  profileQueryFields,
  selectProfileResponse,
} = require('../../../server/services/profile-response.server.service');

describe('Service: profile-response', function () {
  it('exposes the same service functions through ESM and CommonJS', async function () {
    const esmService = await import(
      '../../../server/services/profile-response.server.service.mjs'
    );

    esmService.profileQueryFields.should.equal(profileQueryFields);
    esmService.selectProfileResponse.should.equal(selectProfileResponse);
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
    lastIpAddress: '192.0.2.1',
    pushRegistration: [{ token: 'fictional-push-token' }],
    providerData: [{ accessToken: 'fictional-provider-token' }],
    futurePrivateField: 'must stay private',
    additionalProvidersData: {
      facebook: { id: 'fictional-facebook-id', accessToken: 'private' },
    },
  };

  it('queries only the approved public profile fields', function () {
    profileQueryFields.should.containEql('additionalProvidersData.facebook.id');
    profileQueryFields.should.not.containEql('lastIpAddress');
    profileQueryFields.should.not.containEql('pushRegistration');
  });

  it('returns only public fields for another member', function () {
    const response = selectProfileResponse(profile, false);

    response.username.should.equal('fictional-member');
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
    const response = selectProfileResponse(profile, true);

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
});
