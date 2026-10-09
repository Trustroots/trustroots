const should = require('should');
const sinon = require('sinon');
const crypto = require('node:crypto');
const config = require('../../../../../config/config.mjs');
require('./../../../server/models/user.server.model.mjs');
const mfaService = require('./../../../server/services/mfa.server.service.mjs');
const User = require('mongoose').model('User');

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

  it('rejects missing encrypted values and malformed base32 secrets', function () {
    (() => mfaService.decryptSecret(null)).should.throw(
      'Invalid encrypted authenticator secret.',
    );
    (() => mfaService.matchingCounter('!', '123456', 59000)).should.throw(
      'Invalid authenticator secret.',
    );
  });

  it('normalises an empty recovery-code input', function () {
    mfaService.hashRecoveryCode(null).should.have.length(64);
  });

  it('encodes staged secrets with non-byte-aligned base32 values', async function () {
    sinon.stub(User, 'updateOne').returns({ exec: async () => ({}) });
    sinon
      .stub(crypto, 'randomBytes')
      .callsFake(size => Buffer.alloc(size === 20 ? 1 : size, 1));

    const setup = await mfaService.stageEnrollment('fictional-user', 'member');

    setup.provisioningUri.should.containEql('secret=AE&');
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
    should(
      mfaService.matchingCounter(
        'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
        'bad-code',
      ),
    ).equal(null);
  });

  it('verifies TOTP and recovery attempts without an expected auth version', async function () {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const storedUser = {
      _id: 'fictional-user',
      mfaEnabled: true,
      mfaSecretEncrypted: mfaService.encryptSecret(secret),
      mfaRecoveryCodeHashes: [],
      authVersion: 0,
    };
    const findQuery = {
      select: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves(storedUser),
    };
    sinon.stub(User, 'findById').returns(findQuery);
    const updateQuery = { exec: sinon.stub().resolves(null) };
    sinon.stub(User, 'findOneAndUpdate').returns(updateQuery);

    should(
      await mfaService.verifyAndConsume('fictional-user', '287082', 59000),
    ).equal(null);
    should(
      await mfaService.verifyAndConsume('fictional-user', 'ABCDEF0123456789'),
    ).equal(null);
    User.findOneAndUpdate.calledTwice.should.be.true();
    User.findOneAndUpdate.firstCall.args[0].should.not.have.property(
      'authVersion',
    );
    User.findOneAndUpdate.secondCall.args[0].should.not.have.property(
      'authVersion',
    );
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
