const crypto = require('node:crypto');
const sinon = require('sinon');
require('should');

const passwordHashing = require('../../../server/services/password-hashing.server.service');

describe('Service: password hashing', function () {
  this.timeout(15000);

  it('exposes active and queued counts without credential data', function () {
    const state = passwordHashing.getKdfState();
    Object.keys(state).sort().should.deepEqual(['active', 'queued']);
    state.active.should.be.a.Number();
    state.queued.should.be.a.Number();
  });

  it('bounds production work to one active and 64 queued derivations', async function () {
    let releaseFirst;
    const scryptStub = sinon
      .stub(crypto, 'scrypt')
      .callsFake((password, salt, keyLength, options, callback) => {
        if (!releaseFirst) {
          releaseFirst = () => callback(null, Buffer.alloc(keyLength, 1));
          return;
        }
        callback(null, Buffer.alloc(keyLength, 1));
      });

    try {
      const requests = Array.from({ length: 66 }, () =>
        passwordHashing.hashPassword('fixture-password'),
      );
      const results = requests.map(request =>
        request.then(
          () => null,
          error => error,
        ),
      );

      await new Promise(resolve => setImmediate(resolve));
      passwordHashing.getKdfState().should.deepEqual({ active: 1, queued: 64 });
      releaseFirst();

      const settled = await Promise.all(results);
      settled.filter(Boolean).should.have.length(1);
      settled
        .find(Boolean)
        .should.be.instanceOf(passwordHashing.KdfOverloadedError);
      passwordHashing.getKdfState().should.deepEqual({ active: 0, queued: 0 });
    } finally {
      scryptStub.restore();
    }
  });

  describe('createKdfScheduler', function () {
    it('runs one task at a time and starts queued tasks in order', async function () {
      const scheduler = passwordHashing.createKdfScheduler({
        maxActive: 1,
        maxQueued: 2,
      });
      const order = [];
      let releaseFirst;
      const first = scheduler.run(
        () =>
          new Promise(resolve => {
            releaseFirst = () => {
              order.push('first');
              resolve();
            };
          }),
      );
      const second = scheduler.run(async () => order.push('second'));
      const third = scheduler.run(async () => order.push('third'));

      await new Promise(resolve => setImmediate(resolve));
      scheduler.getState().should.deepEqual({ active: 1, queued: 2 });
      releaseFirst();
      await Promise.all([first, second, third]);

      order.should.deepEqual(['first', 'second', 'third']);
      scheduler.getState().should.deepEqual({ active: 0, queued: 0 });
    });

    it('rejects excess work and invalid scheduler configuration', async function () {
      const scheduler = passwordHashing.createKdfScheduler({
        maxActive: 1,
        maxQueued: 0,
      });
      let release;
      const active = scheduler.run(
        () =>
          new Promise(resolve => {
            release = resolve;
          }),
      );
      await new Promise(resolve => setImmediate(resolve));
      await scheduler
        .run(() => {})
        .should.be.rejectedWith(passwordHashing.KdfOverloadedError);
      new passwordHashing.KdfOverloadedError().status.should.equal(503);
      release();
      await active;

      (() =>
        passwordHashing.createKdfScheduler({
          maxActive: 0,
          maxQueued: 0,
        })).should.throw(TypeError);
      (() =>
        passwordHashing.createKdfScheduler({
          maxActive: 1,
          maxQueued: -1,
        })).should.throw(TypeError);
      await passwordHashing
        .createKdfScheduler({ maxActive: 1, maxQueued: 0 })
        .run(null)
        .should.be.rejectedWith(TypeError);
    });

    it('releases capacity after a task throws or rejects', async function () {
      const scheduler = passwordHashing.createKdfScheduler({
        maxActive: 1,
        maxQueued: 1,
      });
      await scheduler
        .run(() => {
          throw new Error('failure');
        })
        .should.be.rejected();
      await scheduler
        .run(() => Promise.reject(new Error('failure')))
        .should.be.rejected();
      scheduler.getState().should.deepEqual({ active: 0, queued: 0 });
      (await scheduler.run(async () => 'available')).should.equal('available');
    });
  });

  describe('hashPassword and verifyPassword', function () {
    let storedPassword;

    before(async function () {
      storedPassword = await passwordHashing.hashPassword(
        'correct horse battery staple',
      );
    });

    it('stores a versioned scrypt hash with a fresh random salt', async function () {
      storedPassword.should.match(
        /^\$scrypt\$v=1\$ln=17,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/,
      );
      (
        await passwordHashing.hashPassword('correct horse battery staple')
      ).should.not.equal(storedPassword);
    });

    it('verifies the current hash asynchronously and rejects a wrong password', async function () {
      (
        await passwordHashing.verifyPassword(
          'correct horse battery staple',
          storedPassword,
        )
      ).should.deepEqual({ valid: true, needsRehash: false });
      (
        await passwordHashing.verifyPassword(
          'incorrect password',
          storedPassword,
        )
      ).should.deepEqual({ valid: false, needsRehash: false });
    });

    it('does not accept altered parameters, encoding, or a mixed legacy salt', async function () {
      const invalidHashes = [
        storedPassword.replace('ln=17,r=8,p=1', 'ln=18,r=8,p=1'),
        storedPassword.replace(/\$([A-Za-z0-9_-]{22})\$/, '$A$'),
        `${storedPassword}=`,
      ];
      for (const invalidHash of invalidHashes) {
        (
          await passwordHashing.verifyPassword('candidate', invalidHash)
        ).should.deepEqual({ valid: false, needsRehash: false });
      }
      (
        await passwordHashing.verifyPassword(
          'candidate',
          storedPassword,
          'legacy',
        )
      ).should.deepEqual({ valid: false, needsRehash: false });
    });

    it('hashes plaintext even when it resembles a tagged hash', async function () {
      const plaintext = '$scrypt$v=1$ln=17,r=8,p=1$not-a-salt$not-a-key';
      const hashed = await passwordHashing.hashPassword(plaintext);
      hashed.should.not.equal(plaintext);
      (
        await passwordHashing.verifyPassword(plaintext, hashed)
      ).valid.should.be.true();
    });

    it('rejects non-string passwords for hashing and uses dummy work for unknown records', async function () {
      await passwordHashing
        .hashPassword(null)
        .should.be.rejectedWith(TypeError);
      (
        await passwordHashing.verifyPassword('candidate', 'unknown-format')
      ).should.deepEqual({ valid: false, needsRehash: false });
      (
        await passwordHashing.verifyPassword('candidate', null, '')
      ).should.deepEqual({ valid: false, needsRehash: false });
      (
        await passwordHashing.verifyPassword(null, 'unknown-format')
      ).should.deepEqual({ valid: false, needsRehash: false });
      (await passwordHashing.dummyVerifyPassword(null)).should.be.false();
    });

    it('verifies legacy PBKDF2 hashes and marks successful logins for upgrade', async function () {
      const salt = crypto.randomBytes(16);
      const legacyKey = crypto.pbkdf2Sync(
        'legacy password',
        salt,
        10000,
        64,
        'sha1',
      );
      const encodedSalt = salt.toString('base64');
      const encodedKey = legacyKey.toString('base64');

      (
        await passwordHashing.verifyPassword(
          'legacy password',
          encodedKey,
          encodedSalt,
        )
      ).should.deepEqual({ valid: true, needsRehash: true });
      (
        await passwordHashing.verifyPassword(
          'wrong password',
          encodedKey,
          encodedSalt,
        )
      ).should.deepEqual({ valid: false, needsRehash: false });
    });

    it('runs dummy current-cost work for malformed legacy records', async function () {
      (
        await passwordHashing.verifyPassword('candidate', 'bad-key', 'bad-salt')
      ).should.deepEqual({ valid: false, needsRehash: false });
      (
        await passwordHashing.verifyPassword('candidate', 'bad-key', 'AA==')
      ).should.deepEqual({ valid: false, needsRehash: false });
    });

    it('propagates KDF provider errors and releases the scheduler slot', async function () {
      const originalScrypt = crypto.scrypt;
      const originalPbkdf2 = crypto.pbkdf2;
      try {
        crypto.scrypt = (password, salt, keyLength, options, callback) => {
          callback(new Error('scrypt unavailable'));
        };
        await passwordHashing
          .hashPassword('candidate')
          .should.be.rejectedWith('scrypt unavailable');

        crypto.scrypt = originalScrypt;
        crypto.pbkdf2 = (
          password,
          salt,
          iterations,
          keyLength,
          digest,
          callback,
        ) => {
          callback(new Error('pbkdf2 unavailable'));
        };
        const validLegacyKey = Buffer.alloc(64).toString('base64');
        const validLegacySalt = Buffer.alloc(16).toString('base64');
        await passwordHashing
          .verifyPassword('candidate', validLegacyKey, validLegacySalt)
          .should.be.rejectedWith('pbkdf2 unavailable');
      } finally {
        crypto.scrypt = originalScrypt;
        crypto.pbkdf2 = originalPbkdf2;
      }
      (await passwordHashing.hashPassword('capacity restored')).should.match(
        /^\$scrypt\$/,
      );
    });
  });
});
