const crypto: typeof import('node:crypto') = require('node:crypto');
const sinon: typeof import('sinon') = require('sinon');
require('should');

const passwordHashing: typeof import('../../../server/services/password-hashing.server.service.mjs') = require('../../../server/services/password-hashing.server.service.mjs');

describe('Service: password hashing', { timeout: 15000 }, function () {
  it('exposes active and queued counts without credential data', function () {
    const state = passwordHashing.getKdfState();
    Object.keys(state).sort().should.deepEqual(['active', 'queued']);
    state.active.should.be.a.Number();
    state.queued.should.be.a.Number();
  });

  it('bounds production work to one active and 64 queued derivations', async function () {
    let releaseFirst: (() => void) | undefined;
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
          (error: unknown) => error,
        ),
      );

      await new Promise(resolve => setImmediate(resolve));
      passwordHashing.getKdfState().should.deepEqual({ active: 1, queued: 64 });
      releaseFirst!();

      const settled = await Promise.all(results);
      settled.filter(Boolean).should.have.length(1);
      const overloaded = settled.find(
        (value): value is Error => value instanceof Error,
      );
      if (!overloaded) throw new Error('expected one rejected KDF request');
      overloaded.should.be.instanceOf(passwordHashing.KdfOverloadedError);
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
      const order: string[] = [];
      let releaseFirst: (() => void) | undefined;
      const first = scheduler.run(
        () =>
          new Promise<void>(resolve => {
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
      releaseFirst!();
      await Promise.all([first, second, third]);

      order.should.deepEqual(['first', 'second', 'third']);
      scheduler.getState().should.deepEqual({ active: 0, queued: 0 });
    });

    it('rejects excess work and invalid scheduler configuration', async function () {
      const scheduler = passwordHashing.createKdfScheduler({
        maxActive: 1,
        maxQueued: 0,
      });
      let release: (() => void) | undefined;
      const active = scheduler.run(
        () =>
          new Promise<void>(resolve => {
            release = resolve;
          }),
      );
      await new Promise(resolve => setImmediate(resolve));
      await scheduler
        .run(() => {})
        .should.be.rejectedWith(passwordHashing.KdfOverloadedError);
      new passwordHashing.KdfOverloadedError().should.match({
        message: 'Password service is temporarily busy. Please try again.',
        name: 'KdfOverloadedError',
        code: 'KDF_OVERLOADED',
        status: 503,
        userFacing: true,
      });
      release!();
      await active;

      (() =>
        passwordHashing.createKdfScheduler({
          maxActive: 0,
          maxQueued: 0,
        })).should.throw(TypeError, {
        message: 'maxActive must be a positive integer.',
      });
      (() =>
        passwordHashing.createKdfScheduler({
          maxActive: 1,
          maxQueued: -1,
        })).should.throw(TypeError, {
        message: 'maxQueued must be a non-negative integer.',
      });
      await passwordHashing
        .createKdfScheduler({ maxActive: 1, maxQueued: 0 })
        .run(null)
        .should.be.rejectedWith('task must be a function.');
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
    let storedPassword: string;

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
      // Precomputed with N=2^17, r=8, p=1 so the scrypt parameters are pinned.
      const fixture =
        '$scrypt$v=1$ln=17,r=8,p=1$dHJ1c3Ryb290cy1maXh0IQ$DPfT46nLkY_TEH1-IR075e_ZwKoPM1it9EDnHzFJVwE';
      for (const [password, hash, valid] of [
        ['correct horse battery staple', storedPassword, true],
        ['correct horse battery staple', fixture, true],
        ['incorrect password', storedPassword, false],
      ] as const) {
        (await passwordHashing.verifyPassword(password, hash)).should.deepEqual(
          { valid, needsRehash: false },
        );
      }
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
        .should.be.rejectedWith('password must be a string.');
      for (const [password, stored, salt] of [
        ['candidate', 'unknown-format', undefined],
        ['candidate', null, ''],
        [null, 'unknown-format', undefined],
      ]) {
        (
          await passwordHashing.verifyPassword(password, stored, salt)
        ).should.deepEqual({ valid: false, needsRehash: false });
      }
      (await passwordHashing.dummyVerifyPassword(null)).should.be.false();
    });

    describe('with a stubbed scrypt', function () {
      const salt = Buffer.alloc(16).toString('base64url');
      const key = Buffer.alloc(32, 1).toString('base64url');
      const hash = (...parts: string[]) =>
        ['', 'scrypt', 'v=1', 'ln=17,r=8,p=1', ...parts].join('$');
      // Same bytes, but with non-zero padding bits in the last character.
      const nonCanonical = (value: string) =>
        value.slice(0, -1) +
        String.fromCharCode(value.charCodeAt(value.length - 1) + 1);
      let derived: Uint8Array;
      let scrypt: sinon.SinonStub;

      beforeEach(function () {
        derived = Buffer.alloc(32, 1);
        scrypt = sinon
          .stub(crypto, 'scrypt')
          .callsFake((password, salt, keyLength, options, callback) =>
            callback(null, derived as NonSharedBuffer),
          );
      });
      afterEach(function () {
        scrypt.restore();
      });

      it('accepts only the exact current format without a legacy salt', async function () {
        const cases: Array<[string, unknown, boolean]> = [
          [hash(salt, key), undefined, true],
          [hash(salt, key), null, true],
          [hash(salt, key), '', true],
          [hash(salt, key), 'legacy', false],
          [`${hash(salt, key)}$extra`, undefined, false],
          [hash(salt, key).replace('v=1', 'v=2'), undefined, false],
          [hash(salt, key).replace('ln=17', 'ln=18'), undefined, false],
          [hash(Buffer.alloc(15).toString('base64url'), key), undefined, false],
          [hash(nonCanonical(salt), key), undefined, false],
          [hash(salt, nonCanonical(key)), undefined, false],
          [hash('A', key), undefined, false],
          [`${hash(salt, key)}=`, undefined, false],
        ];
        for (const [stored, legacySalt, valid] of cases) {
          (
            await passwordHashing.verifyPassword('pw', stored, legacySalt)
          ).should.deepEqual({ valid, needsRehash: false });
        }
      });

      it('rejects derived keys that are not same-length buffers', async function () {
        for (const value of [
          new Uint8Array(Buffer.alloc(32, 1)),
          Buffer.alloc(31, 1),
        ]) {
          derived = value;
          (
            await passwordHashing.verifyPassword('pw', hash(salt, key))
          ).should.deepEqual({ valid: false, needsRehash: false });
        }
      });

      it('derives keys from the candidate, or the empty string for non-strings', async function () {
        await passwordHashing.dummyVerifyPassword('pw');
        await passwordHashing.dummyVerifyPassword(null);
        await passwordHashing.verifyPassword(null, hash(salt, key));
        scrypt.args.map(args => args[0]).should.deepEqual(['pw', '', '']);
      });

      it('verifies legacy PBKDF2 hashes and runs dummy work only on failure', async function () {
        const legacy = (password: string, saltBytes: Buffer) =>
          crypto
            .pbkdf2Sync(password, saltBytes, 10000, 64, 'sha1')
            .toString('base64');
        const legacySalt = Buffer.alloc(16).toString('base64');
        const encodedKey = legacy('legacy password', Buffer.alloc(16));
        const cases: Array<[string, unknown, unknown, boolean, number]> = [
          ['legacy password', encodedKey, legacySalt, true, 0],
          ['wrong password', encodedKey, legacySalt, false, 1],
          ['legacy password', encodedKey, 'AAAAAAAAAAAAAAAAAAAAAB==', false, 1],
          [
            'legacy password',
            legacy('legacy password', Buffer.alloc(15)),
            Buffer.alloc(15).toString('base64'),
            false,
            1,
          ],
          ['legacy password', encodedKey, 12345, false, 1],
          ['legacy password', encodedKey, 'bad-salt', false, 1],
          ['candidate', 'bad-key', legacySalt, false, 1],
          ['candidate', 'bad-key', 'AA==', false, 1],
        ];
        for (const [password, stored, salt, valid, dummyRuns] of cases) {
          scrypt.resetHistory();
          (
            await passwordHashing.verifyPassword(password, stored, salt)
          ).should.deepEqual({ valid, needsRehash: valid });
          scrypt.callCount.should.equal(dummyRuns);
        }
      });
    });

    it('propagates KDF provider errors and releases the scheduler slot', async function () {
      const scryptStub = sinon
        .stub(crypto, 'scrypt')
        .callsFake((password, salt, keyLength, options, callback) => {
          callback(new Error('scrypt unavailable'), Buffer.alloc(keyLength));
        });
      const pbkdf2Stub = sinon
        .stub(crypto, 'pbkdf2')
        .callsFake(
          (password, salt, iterations, keyLength, digest, callback) => {
            callback(new Error('pbkdf2 unavailable'), Buffer.alloc(keyLength));
          },
        );
      try {
        await passwordHashing
          .hashPassword('candidate')
          .should.be.rejectedWith('scrypt unavailable');

        const validLegacyKey = Buffer.alloc(64).toString('base64');
        const validLegacySalt = Buffer.alloc(16).toString('base64');
        await passwordHashing
          .verifyPassword('candidate', validLegacyKey, validLegacySalt)
          .should.be.rejectedWith('pbkdf2 unavailable');
      } finally {
        scryptStub.restore();
        pbkdf2Stub.restore();
      }
      (await passwordHashing.hashPassword('capacity restored')).should.match(
        /^\$scrypt\$/,
      );
    });
  });
});
