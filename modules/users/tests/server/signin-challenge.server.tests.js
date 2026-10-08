const assert = require('assert/strict');
const crypto = require('crypto');
const config = require('../../../../config/config.mjs');
const {
  issueChallenge,
  verifyChallenge,
  createSigninChallenge,
} = require('../../server/services/signin-challenge.server.service.mjs');

function solve(challenge) {
  for (let solution = 0; solution <= 4194304; solution++) {
    const hash = crypto
      .createHash('sha256')
      .update(challenge.token + ':' + solution)
      .digest();
    if (hash[0] === 0 && (hash[1] & 252) === 0)
      return { token: challenge.token, solution };
  }
  throw new Error('Could not solve test challenge.');
}
function res() {
  return {
    code: 200,
    status(code) {
      this.code = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}
describe('Account-wide sign-in challenge', function () {
  it('binds proofs to the account, address and expiry', function () {
    const now = Date.now();
    const challenge = issueChallenge('member', '192.0.2.1', now);
    const proof = solve(challenge);
    assert.equal(verifyChallenge(proof, 'member', '192.0.2.1', now), true);
    assert.equal(verifyChallenge(proof, 'other', '192.0.2.1', now), false);
    assert.equal(verifyChallenge(proof, 'member', '192.0.2.2', now), false);
    assert.equal(
      verifyChallenge(proof, 'member', '192.0.2.1', now + 120000),
      false,
    );
    assert.equal(
      verifyChallenge(proof, 'member', '192.0.2.1', now - 120001),
      false,
    );
    assert.equal(
      verifyChallenge(
        { ...proof, token: proof.token + 'x' },
        'member',
        '192.0.2.1',
      ),
      false,
    );
    assert.equal(
      verifyChallenge(
        {
          ...proof,
          token:
            proof.token.slice(0, -1) + (proof.token.endsWith('a') ? 'b' : 'a'),
        },
        'member',
        '192.0.2.1',
      ),
      false,
    );
  });
  it('rejects malformed, unsolved and incorrectly signed proofs', function () {
    const challenge = issueChallenge('member', '192.0.2.1');
    let unsolved = 0;
    while (
      verifyChallenge(
        { token: challenge.token, solution: unsolved },
        'member',
        '192.0.2.1',
      )
    )
      unsolved++;
    for (const proof of [
      null,
      {},
      { token: 1 },
      { token: 'x'.repeat(2049) },
      { token: challenge.token, solution: -1 },
      { token: challenge.token, solution: 4194305 },
      { token: challenge.token, solution: 1.5 },
      { token: 'no-dot', solution: 0 },
      { token: 'a.' + 'é'.repeat(43), solution: 0 },
      { token: challenge.token, solution: unsolved },
    ]) {
      assert.equal(verifyChallenge(proof, 'member', '192.0.2.1'), false);
    }
    const payload = Buffer.from('{bad json').toString('base64url');
    const signature = crypto
      .createHmac('sha256', config.sessionSecret)
      .update('signin-challenge:' + payload)
      .digest('base64url');
    assert.equal(
      verifyChallenge(
        { token: payload + '.' + signature, solution: 0 },
        'member',
        '192.0.2.1',
      ),
      false,
    );
  });
  it('rejects authenticated but malformed payloads and partial proofs', function () {
    const now = Date.now();
    const challenge = issueChallenge('member', '192.0.2.1', now);
    const payload = JSON.parse(
      Buffer.from(challenge.token.split('.')[0], 'base64url').toString(),
    );
    for (const value of [null, { ...payload, expires: 'future' }]) {
      const encoded = Buffer.from(JSON.stringify(value)).toString('base64url');
      const mac = crypto
        .createHmac('sha256', config.sessionSecret)
        .update('signin-challenge:' + encoded)
        .digest('base64url');
      assert.equal(
        verifyChallenge(
          { token: encoded + '.' + mac, solution: 0 },
          'member',
          '192.0.2.1',
          now,
        ),
        false,
      );
    }
    let partial = 0;
    let partialDifficultySolutionFound = false;
    for (; partial <= 4_194_304; partial++) {
      const hash = crypto
        .createHash('sha256')
        .update(challenge.token + ':' + partial)
        .digest();
      if (hash[0] === 0 && (hash[1] & 252) !== 0) {
        partialDifficultySolutionFound = true;
        break;
      }
    }
    assert.equal(partialDifficultySolutionFound, true);
    assert.equal(
      verifyChallenge(
        { token: challenge.token, solution: partial },
        'member',
        '192.0.2.1',
        now,
      ),
      false,
    );
  });

  it('does not let a proof cross its replay-counter window', function () {
    const challenge = issueChallenge('member', '192.0.2.1', 299999);
    assert.equal(
      verifyChallenge(solve(challenge), 'member', '192.0.2.1', 300000),
      false,
    );
  });
  it('counts the same normalised account independently of the source IP', async function () {
    const calls = [];
    const middleware = createSigninChallenge({
      address: req => req.ip,
      consume: async options => {
        calls.push(options);
        return { allowed: true };
      },
    });
    let next = 0;
    for (const ip of ['192.0.2.1', '192.0.2.2'])
      await middleware(
        { body: { username: ' Sample.Member ' }, ip },
        res(),
        () => next++,
      );
    assert.equal(next, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].dimensions[0].value, 'sample.member');
  });
  it('issues a challenge on elevated activity and consumes a proof exactly once', async function () {
    let used = false;
    const middleware = createSigninChallenge({
      address: () => '192.0.2.1',
      consume: async ({ operation }) => {
        if (operation === 'signin-account') return { allowed: false };
        const allowed = !used;
        used = true;
        return { allowed };
      },
    });
    const request = { body: { username: 'member' } };
    const first = res();
    let next = 0;
    await middleware(request, first, () => next++);
    assert.equal(first.code, 429);
    request.body.signinProof = solve(first.body.signinChallenge);
    await middleware(request, res(), () => next++);
    assert.equal(next, 1);
    const replay = res();
    await middleware(request, replay, () => next++);
    assert.equal(replay.code, 429);
    assert.equal(next, 1);
  });
  it('passes malformed identities to credential validation and fails closed on missing IP/storage errors', async function () {
    let next = 0;
    const missing = createSigninChallenge({ address: () => undefined });
    for (const body of [
      undefined,
      {},
      { username: 12 },
      { username: 'a'.repeat(321) },
    ])
      await missing({ body }, res(), () => next++);
    assert.equal(next, 4);
    const response = res();
    await missing({ body: { username: 'member' } }, response, () => next++);
    assert.equal(response.code, 503);
    const broken = createSigninChallenge({
      address: () => '192.0.2.1',
      consume: async () => {
        throw new Error('offline');
      },
    });
    await broken({ body: { username: 'member' } }, response, () => next++);
    assert.equal(response.code, 503);
  });
});
