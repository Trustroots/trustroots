const should: typeof import('should') = require('should');
const {
  NETWORKS,
  connectionSearchKey,
  connectionUrl,
  currentConnections,
  normaliseIdentifier,
  parseConnectionSearch,
} =
  require('../../shared/network-connections.ts') as typeof import('../../shared/network-connections.ts');

describe('network connections shared helpers', function () {
  it('defines the supported network identifiers and labels', function () {
    NETWORKS.map(
      (network: (typeof NETWORKS)[number]) => network.id,
    ).should.deepEqual([
      'couchers',
      'bewelcome',
      'couchsurfing',
      'warmshowers',
      'servas',
      'nostr',
      'facebook',
      'twitter',
      'github',
    ]);
  });

  it('extracts all current connection fields and omits empty values', function () {
    currentConnections({
      extSitesCouchers: '  Coucher  ',
      extSitesBW: '',
      extSitesCS: 'cs-name',
      extSitesWS: null,
      extSitesServas: 'household/Family',
      nostrNpub: 'NPUB-KEY',
      additionalProvidersData: {
        facebook: { id: 'opaque/ID' },
        twitter: { screen_name: 'member' },
        github: { login: 'GitHub-Name' },
      },
    }).should.deepEqual([
      { network: 'couchers', identifier: 'Coucher' },
      { network: 'couchsurfing', identifier: 'cs-name' },
      { network: 'servas', identifier: 'household/Family' },
      { network: 'nostr', identifier: 'NPUB-KEY' },
      { network: 'facebook', identifier: 'opaque/ID' },
      { network: 'twitter', identifier: 'member' },
      { network: 'github', identifier: 'GitHub-Name' },
    ]);
  });

  it('normalises case-insensitive networks and preserves Servas paths and Facebook IDs', function () {
    normaliseIdentifier('couchers', '  MixedName ').should.equal('mixedname');
    normaliseIdentifier('nostr', 'NPUB-KEY').should.equal('npub-key');
    normaliseIdentifier('servas', ' /household/Family/ ').should.equal(
      'household/Family',
    );
    normaliseIdentifier('facebook', ' Opaque/ID ').should.equal('Opaque/ID');
    connectionSearchKey('servas', 'household/Family').should.equal(
      'servas:household/Family',
    );
  });

  it('builds profile links for every network', function () {
    const examples: Array<[(typeof NETWORKS)[number]['id'], string, string]> = [
      ['couchers', 'Member Name', 'https://couchers.org/user/member%20name'],
      ['bewelcome', 'Member', 'https://www.bewelcome.org/members/member'],
      ['couchsurfing', 'Member', 'https://www.couchsurfing.com/people/member'],
      ['warmshowers', 'Member', 'https://www.warmshowers.org/users/member'],
      ['servas', 'household/Family', 'https://servas.org/household/Family'],
      ['nostr', 'NPUB-KEY', 'https://nos.trustroots.org/v0/#profile/npub-key'],
      ['facebook', 'OpaqueID', 'https://www.facebook.com/OpaqueID'],
      ['twitter', 'Member', 'https://x.com/member'],
      ['github', 'Member', 'https://github.com/member'],
    ];
    examples.forEach(([network, identifier, expected]) => {
      should(connectionUrl(network, identifier)).equal(expected);
    });
  });

  it('parses supported profile URLs into identifiers', function () {
    const examples: Array<[(typeof NETWORKS)[number]['id'], string, string]> = [
      ['couchers', 'https://couchers.org/user/Member', 'member'],
      ['bewelcome', 'https://www.bewelcome.org/members/Member', 'member'],
      ['couchsurfing', 'https://couchsurfing.com/people/Member', 'member'],
      ['warmshowers', 'https://warmshowers.org/users/Member', 'member'],
      ['servas', 'https://servas.org/household/Family', 'household/Family'],
      ['facebook', 'https://facebook.com/SomeID', 'SomeID'],
      ['facebook', 'https://www.facebook.com/profile.php?id=SomeID', 'SomeID'],
      ['twitter', 'https://x.com/Member', 'member'],
      ['github', 'https://github.com/Member', 'member'],
    ];
    examples.forEach(([network, input, expected]) => {
      should(parseConnectionSearch(network, input)).equal(expected);
    });
  });

  it('returns null for empty, unsupported, malformed, or non-profile URLs', function () {
    (parseConnectionSearch('github', '') === null).should.be.true();
    (
      parseConnectionSearch('nostr', 'https://njump.me/') === null
    ).should.be.true();
    (
      parseConnectionSearch('github', 'https://example.test/member') === null
    ).should.be.true();
    (
      parseConnectionSearch('github', 'https://github.com/') === null
    ).should.be.true();
    (parseConnectionSearch('github', 'https://%') === null).should.be.true();
    (
      parseConnectionSearch('github', 'https://github.com/%ZZ') === null
    ).should.be.true();
    should(parseConnectionSearch('servas', 'https://servas.org/')).equal(null);
    should(parseConnectionSearch('servas', ' Household/Family ')).equal(
      'Household/Family',
    );
  });
});
