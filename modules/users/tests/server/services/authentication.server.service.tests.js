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
    it('accepts valid usernames and normalizes uppercase input', function () {
      authenticationService.validateUsername('Good_Name-1').should.be.true();
      authenticationService.validateUsername('good.name-1').should.be.true();
    });

    it('rejects usernames that are too short or too long', function () {
      authenticationService.validateUsername('ab').should.be.false();
      authenticationService.validateUsername('a'.repeat(35)).should.be.false();
    });

    it('rejects usernames without an alphanumeric character', function () {
      authenticationService.validateUsername('---').should.be.false();
      authenticationService.validateUsername('...').should.be.false();
    });

    it('rejects usernames with unsupported characters', function () {
      authenticationService.validateUsername('bad/name').should.be.false();
      authenticationService.validateUsername('bad name').should.be.false();
    });

    it('rejects usernames with invalid dot placement', function () {
      authenticationService.validateUsername('.alice').should.be.false();
      authenticationService.validateUsername('alice.').should.be.false();
      authenticationService.validateUsername('al..ice').should.be.false();
    });

    it('rejects reserved usernames case-insensitively', function () {
      authenticationService.validateUsername('TrustRoots').should.be.false();
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
