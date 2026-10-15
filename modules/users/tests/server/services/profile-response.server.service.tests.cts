import type {
  MiniProfile,
  OwnProfile,
  PublicProviderIdentities,
  UpdateProfileRequest,
} from '../../../shared/profile.js';

const hasRuntimeField = (value: object, field: string): boolean =>
  Object.hasOwn(value, field);

require('should');
const profileResponseService: typeof import('./../../../server/services/profile-response.server.service.mts') = require('./../../../server/services/profile-response.server.service.cjs');
const {
  profileQueryFields,
  selectProfileUpdateFields,
  selectProfileResponse,
  selectMiniProfileResponse,
}: typeof import('./../../../server/services/profile-response.server.service.mts') =
  profileResponseService;

describe('Service: profile-response', function () {
  let esmService: typeof import('../../../server/services/profile-response.server.service.mts');

  before(async function () {
    esmService =
      await import('../../../server/services/profile-response.server.service.mts');
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

  const profile: OwnProfile<string, Date> & {
    nostrVerifiedNpub: string;
    nostrVerifiedAt: Date;
    lastIpAddress: string;
    pushRegistration: Array<{ token: string }>;
    providerData: Array<{ accessToken: string }>;
    futurePrivateField: string;
    additionalProvidersData: PublicProviderIdentities & {
      facebook: { id: string; accessToken: string };
      twitter: { screen_name: string; accessToken: string };
      github: { login: string; accessToken: string };
    };
  } = {
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
    nostrNpub: 'npub1fictional',
    nostrVerifiedNpub: 'npub1fictional',
    nostrVerifiedAt: new Date('2026-01-02T03:04:05.000Z'),
    additionalProvidersData: {
      facebook: { id: 'fictional-facebook-id', accessToken: 'private' },
      twitter: { screen_name: 'fictional-twitter', accessToken: 'private' },
      github: { login: 'fictional-github', accessToken: 'private' },
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
    const updateWithUnpersistedFields: UpdateProfileRequest & {
      emailTemporary: string;
      providerData: { accessToken: string };
    } = {
      firstName: 'Fictional',
      newsletter: false,
      email: 'member@example.test',
      emailTemporary: 'pending@example.test',
      providerData: { accessToken: 'private' },
    };
    selectProfileUpdateFields(updateWithUnpersistedFields).should.deepEqual({
      firstName: 'Fictional',
      newsletter: false,
    });

    selectProfileUpdateFields({ description: undefined }).should.have.property(
      'description',
    );
  });

  it('omits every editable field absent from the update request', function () {
    selectProfileUpdateFields({}).should.deepEqual({});
  });

  it('selects each accepted editable field', function () {
    const request = {
      firstName: 'Fictional',
      lastName: 'Member',
      tagline: 'A fictional profile',
      description: 'A fictional description',
      birthdate: '1990-01-01',
      gender: 'nonbinary',
      languages: ['en'],
      locationLiving: 'Fictional city',
      locationFrom: 'Fictional region',
      username: 'fictional-member',
      extSitesCouchers: 'fictional-couchers',
      extSitesBW: 'fictional-bw',
      extSitesCS: 'fictional-cs',
      extSitesWS: 'fictional-ws',
      nostrNpub: 'fictional-npub',
      avatarSource: 'gravatar',
      avatarUploaded: false,
      newsletter: false,
      locale: 'en',
      email: 'member@example.test',
    };

    selectProfileUpdateFields(request).should.deepEqual({
      firstName: 'Fictional',
      lastName: 'Member',
      tagline: 'A fictional profile',
      description: 'A fictional description',
      birthdate: '1990-01-01',
      gender: 'nonbinary',
      languages: ['en'],
      locationLiving: 'Fictional city',
      locationFrom: 'Fictional region',
      username: 'fictional-member',
      extSitesCouchers: 'fictional-couchers',
      extSitesBW: 'fictional-bw',
      extSitesCS: 'fictional-cs',
      extSitesWS: 'fictional-ws',
      nostrNpub: 'fictional-npub',
      avatarSource: 'gravatar',
      avatarUploaded: false,
      newsletter: false,
      locale: 'en',
    });
  });

  it('returns only public fields for another member', function () {
    const response = esmService.selectProfileResponse(profile, false);

    response.username.should.equal('fictional-member');
    response.avatarVersion!.should.equal('0123456789abcdef0123456789abcdef');
    const providerIdentities = response.additionalProvidersData!;
    providerIdentities.facebook!.id!.should.equal('fictional-facebook-id');
    providerIdentities.twitter!.screen_name!.should.equal('fictional-twitter');
    providerIdentities.github!.login!.should.equal('fictional-github');
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
      'locationCoordinates',
      'exactAddress',
      'nostrVerifiedNpub',
      'nostrVerifiedAt',
    ]) {
      hasRuntimeField(response, field).should.be.false();
    }
  });

  it('keeps account-editing fields for the account holder only', function () {
    const response = esmService.selectProfileResponse(profile, true);
    response.avatarVersion!.should.equal('0123456789abcdef0123456789abcdef');
    response.nostrVerifiedAt!.should.equal(profile.nostrVerifiedAt);
    hasRuntimeField(response, 'nostrVerifiedNpub').should.be.false();

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
      hasRuntimeField(response, field).should.be.true();
    }
    hasRuntimeField(response, 'futurePrivateField').should.be.false();
    hasRuntimeField(response, 'lastIpAddress').should.be.false();
    hasRuntimeField(response, 'pushRegistration').should.be.false();
    hasRuntimeField(response, 'providerData').should.be.false();
  });

  it('returns only the approved mini-profile identity fields', function () {
    const miniInput: MiniProfile<string, unknown> & {
      public: boolean;
      roles: string[];
      email: string;
      futureField: string;
      additionalProvidersData: PublicProviderIdentities & {
        facebook: { id: string; accessToken: string };
      };
    } = {
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
      } as PublicProviderIdentities & {
        facebook: { id: string; accessToken: string };
      },
      public: true,
      roles: ['admin'],
      blocked: ['fictional-blocked-id'],
      email: 'member@example.test',
      futureField: 'must stay private',
    };
    const mini = selectMiniProfileResponse(miniInput);

    mini.username.should.equal('fictional-member');
    const miniProviders = mini.additionalProvidersData!;
    miniProviders.facebook!.id!.should.equal('fictional-facebook-id');
    hasRuntimeField(miniProviders.facebook!, 'accessToken').should.be.false();
    for (const field of ['public', 'roles', 'email', 'futureField']) {
      hasRuntimeField(mini, field).should.be.false();
    }
    mini.blocked!.should.deepEqual(['fictional-blocked-id']);
  });

  it('omits provider identities when they are absent from a profile', function () {
    const profileWithoutProviders = {
      ...profile,
      additionalProvidersData: {},
    };
    const publicProfile = selectProfileResponse(profileWithoutProviders, false);
    const miniProfile = selectMiniProfileResponse(profileWithoutProviders);

    publicProfile.additionalProvidersData!.should.deepEqual({});
    miniProfile.additionalProvidersData!.should.deepEqual({});

    const profileWithoutProviderField = {
      ...profile,
      additionalProvidersData: undefined,
    };
    const publicProfileWithoutProviders = selectProfileResponse(
      profileWithoutProviderField,
      false,
    );
    const miniProfileWithoutProviders = selectMiniProfileResponse(
      profileWithoutProviderField,
    );
    (
      publicProfileWithoutProviders.additionalProvidersData === undefined
    ).should.be.true();
    (
      miniProfileWithoutProviders.additionalProvidersData === undefined
    ).should.be.true();
  });

  it('omits verification status when it does not match the current saved key', function () {
    const response = selectProfileResponse(
      {
        ...profile,
        nostrVerifiedNpub: 'npub1oldkey',
      },
      true,
    );
    (response.nostrVerifiedAt === undefined).should.be.true();
  });
});
