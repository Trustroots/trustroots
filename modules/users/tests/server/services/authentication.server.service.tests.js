const proxyquire = require('proxyquire').noCallThru();

require('should');

const authenticationService = proxyquire(
  '../../../server/services/authentication.server.service',
  {
    '../../../../config/config': {
      illegalStrings: ['trustroots', 'trust', 'roots'],
    },
  },
);

describe('Service: authentication', function () {
  describe('generateEmailToken', function () {
    it('generates a hex token from salt and email', function () {
      const salt = Buffer.from('salt:');
      const token = authenticationService.generateEmailToken(
        { email: 'user@example.org' },
        salt,
      );

      token.should.equal(Buffer.from('salt:user@example.org').toString('hex'));
    });

    it('prefers the temporary email when present', function () {
      const token = authenticationService.generateEmailToken(
        {
          email: 'old@example.org',
          emailTemporary: 'new@example.org',
        },
        Buffer.from('salt:'),
      );

      token.should.equal(Buffer.from('salt:new@example.org').toString('hex'));
    });
  });

  describe('validateUsername', function () {
    it('accepts lowercase alphanumeric usernames with at least one letter', function () {
      authenticationService.validateUsername('alice').should.be.true();
      authenticationService.validateUsername('alice123').should.be.true();
      authenticationService.validateUsername('a123').should.be.true();
      authenticationService.validateUsername('abc').should.be.true();
      authenticationService
        .validateUsername('a' + '1'.repeat(33))
        .should.be.true();
    });

    it('rejects usernames that are too short or too long', function () {
      authenticationService.validateUsername('').should.be.false();
      authenticationService.validateUsername('ab').should.be.false();
      authenticationService.validateUsername('a'.repeat(35)).should.be.false();
    });

    it('rejects usernames without at least one letter', function () {
      authenticationService.validateUsername('123').should.be.false();
      authenticationService.validateUsername('000').should.be.false();
    });

    it('rejects uppercase and unsupported characters', function () {
      authenticationService.validateUsername('Alice').should.be.false();
      authenticationService.validateUsername('ALICE').should.be.false();
      authenticationService.validateUsername('ali-ce').should.be.false();
      authenticationService.validateUsername('ali.ce').should.be.false();
      authenticationService.validateUsername('ali_ce').should.be.false();
      authenticationService.validateUsername('ali ce').should.be.false();
      authenticationService.validateUsername('alice!').should.be.false();
      authenticationService.validateUsername('ålice').should.be.false();
    });

    it('rejects reserved usernames case-insensitively', function () {
      authenticationService.validateUsername('trustroots').should.be.false();
      authenticationService.validateUsername('TrustRoots').should.be.false();
    });

    it('rejects newly reserved usernames', function () {
      const authenticationService = proxyquire(
        '../../../server/services/authentication.server.service',
        {
          '../../../../config/config': {
            illegalStrings: ['nostr', 'npub', 'help', 'search', 'messages'],
          },
        },
      );

      authenticationService.validateUsername('nostr').should.be.false();
      authenticationService.validateUsername('npub').should.be.false();
      authenticationService.validateUsername('help').should.be.false();
      authenticationService.validateUsername('search').should.be.false();
      authenticationService.validateUsername('messages').should.be.false();
      authenticationService.isUsernameReserved('nostroots').should.be.false();
    });
  });

  describe('isLegacyUsernameLookupValid', function () {
    it('accepts legacy username formats for read-only lookups', function () {
      authenticationService
        .isLegacyUsernameLookupValid('nostruser')
        .should.be.true();
      authenticationService
        .isLegacyUsernameLookupValid('NostrUser')
        .should.be.true();
      authenticationService
        .isLegacyUsernameLookupValid('legacy-user')
        .should.be.true();
      authenticationService
        .isLegacyUsernameLookupValid('legacy.user')
        .should.be.true();
      authenticationService
        .isLegacyUsernameLookupValid('legacy_user')
        .should.be.true();
      authenticationService.isLegacyUsernameLookupValid('123').should.be.true();
    });

    it('does not apply reserved username checks to legacy lookups', function () {
      authenticationService
        .isLegacyUsernameLookupValid('trustroots')
        .should.be.true();
    });

    it('rejects invalid lookup usernames', function () {
      authenticationService.isLegacyUsernameLookupValid('').should.be.false();
      authenticationService.isLegacyUsernameLookupValid('ab').should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid('a'.repeat(35))
        .should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid('legacy user')
        .should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid('legacy!')
        .should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid('ålice')
        .should.be.false();
      authenticationService.isLegacyUsernameLookupValid(null).should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid(['alice'])
        .should.be.false();
      authenticationService
        .isLegacyUsernameLookupValid({ username: 'alice' })
        .should.be.false();
    });
  });

  describe('isUsernameReserved', function () {
    it('detects reserved usernames case-insensitively', function () {
      authenticationService.isUsernameReserved('TRUST').should.be.true();
    });

    it('returns false for allowed usernames', function () {
      authenticationService.isUsernameReserved('traveller').should.be.false();
    });
  });
});
