const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');

require('./../../../server/models/user.server.model.mjs');
const mfaService = require('./../../../server/services/mfa.server.service.mjs');
const User = mongoose.model('User');

const RFC_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_TOTP_CODE = '287082';
const TEST_TIME = 59000;

function queryReturning(result) {
  return {
    select() {
      return this;
    },
    exec: async () => result,
  };
}

describe('Service: authenticator MFA security branches', function () {
  afterEach(() => sinon.restore());

  describe('stageEnrollment', function () {
    it('stores an encrypted secret with a bounded expiry and reset counter', async function () {
      const update = sinon.stub(User, 'updateOne').returns({
        exec: async () => ({ acknowledged: true }),
      });
      const before = Date.now();

      const result = await mfaService.stageEnrollment(
        'fictional-user-id',
        'sample_member',
      );

      const [selector, changes] = update.firstCall.args;
      selector.should.deepEqual({ _id: 'fictional-user-id' });
      changes.$set.mfaPendingLastTotpCounter.should.equal(-1);
      changes.$set.mfaPendingSecretEncrypted.should.not.equal(
        decodeURIComponent(result.provisioningUri.match(/secret=([^&]+)/u)[1]),
      );
      result.expires
        .getTime()
        .should.be.greaterThanOrEqual(before + 10 * 60 * 1000);
      result.expires
        .getTime()
        .should.be.lessThanOrEqual(Date.now() + 10 * 60 * 1000);
      result.provisioningUri.should.startWith(
        'otpauth://totp/Trustroots%3Asample_member?',
      );
      mfaService
        .decryptSecret(changes.$set.mfaPendingSecretEncrypted)
        .should.equal(
          decodeURIComponent(
            result.provisioningUri.match(/secret=([^&]+)/u)[1],
          ),
        );
    });
  });

  describe('activateEnrollment', function () {
    it('rejects missing and expired pending secrets', async function () {
      const findById = sinon.stub(User, 'findById');
      findById.onFirstCall().returns(queryReturning(null));
      findById.onSecondCall().returns(
        queryReturning({
          mfaPendingSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          mfaPendingSecretExpires: new Date(TEST_TIME),
        }),
      );
      const update = sinon.stub(User, 'findOneAndUpdate');

      should(
        await mfaService.activateEnrollment(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
        ),
      ).equal(null);
      should(
        await mfaService.activateEnrollment(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
        ),
      ).equal(null);
      update.called.should.be.false();
    });

    it('atomically activates only the pending secret and unused TOTP counter', async function () {
      const encrypted = mfaService.encryptSecret(RFC_TOTP_SECRET);
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaPendingSecretEncrypted: encrypted,
          mfaPendingSecretExpires: new Date(TEST_TIME + 1),
        }),
      );
      const activated = { _id: 'fictional-user-id', mfaEnabled: true };
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(queryReturning(activated));

      const result = await mfaService.activateEnrollment(
        'fictional-user-id',
        RFC_TOTP_CODE,
        TEST_TIME,
      );

      const [selector, changes, options] = update.firstCall.args;
      selector.mfaPendingSecretEncrypted.should.equal(encrypted);
      selector.mfaPendingSecretExpires.$gt.getTime().should.equal(TEST_TIME);
      selector.mfaPendingLastTotpCounter.$lt.should.equal(1);
      selector.mfaEnabled.$ne.should.equal(true);
      changes.$set.mfaSecretEncrypted.should.equal(encrypted);
      changes.$set.mfaLastTotpCounter.should.equal(1);
      changes.$set.mfaRecoveryCodeHashes.should.have.length(10);
      changes.$unset.mfaPendingSecretEncrypted.should.equal(1);
      changes.$inc.authVersion.should.equal(1);
      options.new.should.be.true();
      result.user.should.equal(activated);
      result.codes.should.have.length(10);
      result.codes.forEach(code => code.should.match(/^[A-F0-9]{16}$/u));
    });

    it('rejects invalid TOTP without attempting activation', async function () {
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaPendingSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          mfaPendingSecretExpires: new Date(TEST_TIME + 1),
        }),
      );
      const update = sinon.stub(User, 'findOneAndUpdate');

      should(
        await mfaService.activateEnrollment(
          'fictional-user-id',
          '123',
          TEST_TIME,
        ),
      ).equal(null);
      update.called.should.be.false();
    });

    it('rejects concurrent activation after the pending secret changes', async function () {
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaPendingSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          mfaPendingSecretExpires: new Date(TEST_TIME + 1),
        }),
      );
      sinon.stub(User, 'findOneAndUpdate').returns(queryReturning(null));

      should(
        await mfaService.activateEnrollment(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
        ),
      ).equal(null);
    });
  });

  describe('verifyAndConsume', function () {
    it('rejects users without an active MFA secret and stale auth versions', async function () {
      const findById = sinon.stub(User, 'findById');
      findById.onFirstCall().returns(queryReturning({ mfaEnabled: false }));
      findById.onSecondCall().returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          authVersion: 5,
        }),
      );
      const update = sinon.stub(User, 'findOneAndUpdate');

      should(
        await mfaService.verifyAndConsume(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
          5,
        ),
      ).equal(null);
      should(
        await mfaService.verifyAndConsume(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
          4,
        ),
      ).equal(null);
      update.called.should.be.false();
    });

    it('consumes a valid TOTP with a CAS on secret, role, auth version, and counter', async function () {
      const encrypted = mfaService.encryptSecret(RFC_TOTP_SECRET);
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: encrypted,
          authVersion: 8,
        }),
      );
      const updated = { _id: 'fictional-user-id' };
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(queryReturning(updated));

      const result = await mfaService.verifyAndConsume(
        'fictional-user-id',
        RFC_TOTP_CODE,
        TEST_TIME,
        8,
      );

      const [selector, changes] = update.firstCall.args;
      selector.mfaSecretEncrypted.should.equal(encrypted);
      selector.roles.$nin.should.containEql('suspended');
      selector.authVersion.should.equal(8);
      selector.mfaLastTotpCounter.$lt.should.equal(1);
      changes.$set.mfaLastTotpCounter.should.equal(1);
      result.should.deepEqual({
        user: updated,
        recovery: false,
        secret: encrypted,
      });
    });

    it('rejects suspended users and replayed counters when the atomic consume fails', async function () {
      const encrypted = mfaService.encryptSecret(RFC_TOTP_SECRET);
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: encrypted,
          authVersion: 2,
        }),
      );
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(queryReturning(null));

      should(
        await mfaService.verifyAndConsume(
          'fictional-user-id',
          RFC_TOTP_CODE,
          TEST_TIME,
          2,
        ),
      ).equal(null);
      update.firstCall.args[0].roles.$nin.should.containEql('suspended');
      update.firstCall.args[0].mfaLastTotpCounter.$lt.should.equal(1);
    });

    it('rejects malformed recovery codes without querying for consumption', async function () {
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          authVersion: 2,
        }),
      );
      const update = sinon.stub(User, 'findOneAndUpdate');

      should(
        await mfaService.verifyAndConsume(
          'fictional-user-id',
          'not-a-code',
          TEST_TIME,
          2,
        ),
      ).equal(null);
      update.called.should.be.false();
    });

    it('consumes a recovery code once using its normalised hash and CAS predicates', async function () {
      const encrypted = mfaService.encryptSecret(RFC_TOTP_SECRET);
      const recoveryCode = '1234abcd5678ef90';
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: encrypted,
          authVersion: 6,
        }),
      );
      const updated = { _id: 'fictional-user-id' };
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(queryReturning(updated));

      const result = await mfaService.verifyAndConsume(
        'fictional-user-id',
        '1234-ABCD-5678-EF90',
        TEST_TIME,
        6,
      );

      const [selector, changes] = update.firstCall.args;
      selector.mfaSecretEncrypted.should.equal(encrypted);
      selector.mfaRecoveryCodeHashes.should.equal(
        mfaService.hashRecoveryCode(recoveryCode),
      );
      selector.roles.$nin.should.containEql('suspended');
      selector.authVersion.should.equal(6);
      changes.$pull.mfaRecoveryCodeHashes.should.equal(
        mfaService.hashRecoveryCode(recoveryCode),
      );
      result.should.deepEqual({
        user: updated,
        recovery: true,
        secret: encrypted,
      });
    });

    it('rejects a recovery code if its hash was already consumed', async function () {
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: mfaService.encryptSecret(RFC_TOTP_SECRET),
          authVersion: 6,
        }),
      );
      sinon.stub(User, 'findOneAndUpdate').returns(queryReturning(null));

      should(
        await mfaService.verifyAndConsume(
          'fictional-user-id',
          '1234ABCD5678EF90',
          TEST_TIME,
          6,
        ),
      ).equal(null);
    });

    it('rejects malformed encrypted secrets instead of authenticating', async function () {
      sinon.stub(User, 'findById').returns(
        queryReturning({
          mfaEnabled: true,
          mfaSecretEncrypted: 'not-an-encrypted-secret',
          authVersion: 6,
        }),
      );

      await mfaService
        .verifyAndConsume('fictional-user-id', RFC_TOTP_CODE, TEST_TIME, 6)
        .should.be.rejected();
    });
  });

  describe('removeMfa', function () {
    it('requires the captured secret and disables MFA with an exact-secret CAS', async function () {
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(
          queryReturning({ _id: 'fictional-user-id', mfaEnabled: false }),
        );

      should(await mfaService.removeMfa('fictional-user-id')).equal(null);
      update.called.should.be.false();

      const encrypted = mfaService.encryptSecret(RFC_TOTP_SECRET);
      const result = await mfaService.removeMfa('fictional-user-id', encrypted);
      const [selector, changes] = update.firstCall.args;
      selector.should.deepEqual({
        _id: 'fictional-user-id',
        mfaEnabled: true,
        mfaSecretEncrypted: encrypted,
      });
      changes.$set.mfaEnabled.should.be.false();
      changes.$set.mfaRecoveryCodeHashes.should.deepEqual([]);
      changes.$unset.mfaSecretEncrypted.should.equal(1);
      changes.$inc.authVersion.should.equal(1);
      result.mfaEnabled.should.be.false();
    });

    it('returns null when the secret changed before the atomic disable', async function () {
      sinon.stub(User, 'findOneAndUpdate').returns(queryReturning(null));

      should(
        await mfaService.removeMfa(
          'fictional-user-id',
          mfaService.encryptSecret(RFC_TOTP_SECRET),
        ),
      ).equal(null);
    });
  });

  it('recognises privileged roles without treating ordinary or suspended roles as privileged', function () {
    mfaService.isPrivileged({ roles: ['user', 'admin'] }).should.be.true();
    mfaService.isPrivileged({ roles: ['user', 'suspended'] }).should.be.false();
    mfaService.isPrivileged(null).should.be.false();
  });
});
