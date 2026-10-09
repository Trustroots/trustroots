const should = require('should');
const sinon = require('sinon');
const config = require('../../../../../config/config.mjs');
require('./../../../server/models/user.server.model.mjs');
const mfaService = require('./../../../server/services/mfa.server.service.mjs');

describe('Service: authenticator MFA', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('requires a configured MFA encryption key', function () {
    sinon.stub(config, 'mfaEncryptionKey').value('');
    should(() => mfaService.encryptSecret('JBSWY3DPEHPK3PXP')).throw(
      'MFA_ENCRYPTION_KEY is required.',
    );
  });

  it('rejects encryption keys that are not 32 bytes', function () {
    sinon.stub(config, 'mfaEncryptionKey').value('c2hvcnQ=');
    should(() => mfaService.encryptSecret('JBSWY3DPEHPK3PXP')).throw(
      'MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
  });

  it('rejects non-canonical base64 encryption keys', function () {
    sinon.stub(config, 'mfaEncryptionKey').value('A'.repeat(43));
    should(() => mfaService.encryptSecret('JBSWY3DPEHPK3PXP')).throw(
      'MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
  });

  it('encrypts TOTP secrets with authenticated encryption', function () {
    const encrypted = mfaService.encryptSecret('JBSWY3DPEHPK3PXP');
    encrypted.should.not.equal('JBSWY3DPEHPK3PXP');
    mfaService.decryptSecret(encrypted).should.equal('JBSWY3DPEHPK3PXP');
  });

  it('rejects a modified encrypted authenticator secret', function () {
    const encrypted = mfaService.encryptSecret('JBSWY3DPEHPK3PXP');
    const [iv, tag, ciphertext] = encrypted.split('.');
    const modified = `${iv}.${tag.startsWith('A') ? 'B' : 'A'}${tag.slice(
      1,
    )}.${ciphertext}`;

    (() => mfaService.decryptSecret(modified)).should.throw();
  });

  it('matches a six-digit TOTP within the allowed time window', function () {
    // RFC 6238 test secret with the six-digit truncation at timestamp 59.
    mfaService
      .matchingCounter('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59000)
      .should.equal(1);
  });

  it('rejects malformed and incorrect TOTP values', function () {
    should(
      mfaService.matchingCounter(
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        'bad-code',
        59000,
      ),
    ).equal(null);
    should(
      mfaService.matchingCounter(
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        '111111',
        59000,
      ),
    ).equal(null);
  });

  it('identifies and expires pre-authentication challenges', function () {
    const challenge = mfaService.createChallenge({
      _id: 'fictional-user-id',
      authVersion: 3,
    });
    mfaService.challengeIsValid(challenge).should.be.true();
    mfaService
      .challengeIsValid({ ...challenge, expiresAt: Date.now() - 1 })
      .should.be.false();
  });

  it('creates recovery codes that survive display normalisation', function () {
    const codes = mfaService.createRecoveryCodes();
    codes.should.have.length(10);
    codes.forEach(code => {
      code.should.match(/^[A-F0-9]{16}$/u);
      mfaService
        .hashRecoveryCode(code)
        .should.equal(
          mfaService.hashRecoveryCode(code.match(/.{1,4}/gu).join('-')),
        );
    });
  });
});
