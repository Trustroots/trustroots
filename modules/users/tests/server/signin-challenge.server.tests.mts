import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import config from '../../../../config/config.mts';
import {
  issueChallenge,
  isSigninProof,
  verifyChallenge,
  createSigninChallenge,
} from '../../server/services/signin-challenge.server.service.mts';

type Dependencies = NonNullable<Parameters<typeof createSigninChallenge>[0]>;
type Request = Parameters<ReturnType<typeof createSigninChallenge>>[0];
type ResponseBody = Parameters<
  Parameters<ReturnType<typeof createSigninChallenge>>[1]['send']
>[0];

function request(body?: Request['body'], ip?: string): Request {
  return { body, ip, get: () => undefined };
}

function solve(challenge: ReturnType<typeof issueChallenge>) {
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
    body: undefined as ResponseBody | undefined,
    status(code: number) {
      this.code = code;
      return this;
    },
    send(body: ResponseBody) {
      this.body = body;
      return this;
    },
  };
}
describe('Account-wide sign-in challenge', function () {
  it('validates the proof input before checking its signature and hash', function () {
    const token = 'x'.repeat(2048);
    assert.equal(isSigninProof({ token, solution: 0 }), true);
    assert.equal(isSigninProof({ token, solution: 4_194_304 }), true);
    for (const proof of [
      null,
      { token: null, solution: 0 },
      { token: token + 'x', solution: 0 },
      { token, solution: undefined },
      { token, solution: '0' },
      { token, solution: -1 },
      { token, solution: 4_194_305 },
      { token, solution: 1.5 },
    ]) {
      assert.equal(isSigninProof(proof), false);
    }
  });

  it('issues distinct proofs with a signed, bounded account and address', function () {
    const now = 600000;
    const challenge = issueChallenge('member', '192.0.2.1', now);
    const second = issueChallenge('member', '192.0.2.1', now);
    const [payload, mac] = challenge.token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const sign = (value: string) =>
      crypto
        .createHmac('sha256', config.sessionSecret)
        .update('signin-challenge:' + value)
        .digest('base64url');

    assert.equal(mac, sign(payload));
    assert.equal(challenge.difficulty, 14);
    assert.equal(claims.expires, now + 120000);
    assert.equal(claims.account, sign('member'));
    assert.equal(claims.ip, sign('192.0.2.1'));
    assert.match(claims.nonce, /^[a-f0-9]{32}$/);
    assert.notEqual(challenge.token, second.token);
  });

  it('binds proofs to the account, address and expiry', function () {
    const now = 600000;
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
    for (;;) {
      const hash = crypto
        .createHash('sha256')
        .update(challenge.token + ':' + unsolved)
        .digest();
      if (hash[0] !== 0 || (hash[1] & 252) !== 0) break;
      unsolved++;
    }
    for (const proof of [
      null,
      {},
      { token: 1 },
      { token: 'x'.repeat(2049) },
      { token: challenge.token },
      { token: challenge.token, solution: -1 },
      { token: challenge.token, solution: 4194305 },
      { token: challenge.token, solution: 1.5 },
      { token: 'no-dot', solution: 0 },
      { token: 'a.' + 'é'.repeat(43), solution: 0 },
      { token: challenge.token, solution: unsolved },
    ]) {
      assert.equal(verifyChallenge(proof, 'member', '192.0.2.1'), false);
    }
    const [originalClaims] = challenge.token.split('.');
    const badSignature = {
      token: originalClaims + '.fictional-mac',
      difficulty: 14,
    };
    assert.equal(
      verifyChallenge(solve(badSignature), 'member', '192.0.2.1'),
      false,
    );

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
    for (const partialMatch of [
      (hash: Buffer) => hash[0] === 0 && (hash[1] & 252) !== 0,
      (hash: Buffer) => hash[0] !== 0 && (hash[1] & 252) === 0,
    ]) {
      let partial = 0;
      for (; partial <= 4_194_304; partial++) {
        const hash = crypto
          .createHash('sha256')
          .update(challenge.token + ':' + partial)
          .digest();
        if (partialMatch(hash)) break;
      }
      assert.ok(partial <= 4_194_304);
      assert.equal(
        verifyChallenge(
          { token: challenge.token, solution: partial },
          'member',
          '192.0.2.1',
          now,
        ),
        false,
      );
    }
  });

  it('does not let a proof cross its replay-counter window', function () {
    const challenge = issueChallenge('member', '192.0.2.1', 299999);
    assert.equal(
      verifyChallenge(solve(challenge), 'member', '192.0.2.1', 300000),
      false,
    );
  });
  it('counts the same normalised account independently of the source IP', async function () {
    const calls: Parameters<NonNullable<Dependencies['consume']>>[0][] = [];
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
        request({ username: ' Sample.Member ' }, ip),
        res(),
        () => next++,
      );
    assert.equal(next, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.deepEqual(calls[0], {
      operation: 'signin-account',
      dimensions: [{ name: 'account', value: 'sample.member', limit: 20 }],
      windowMs: 15 * 60 * 1000,
    });
  });
  it('counts an account identifier at the maximum supported length', async function () {
    const username = 'a'.repeat(320);
    const middleware = createSigninChallenge({
      consume: async ({ dimensions }) => {
        assert.equal(dimensions[0].value, username);
        return { allowed: false };
      },
    });
    const response = res();
    await middleware(request({ username }, '192.0.2.1'), response, () => {
      assert.fail('An account at its limit must receive a challenge.');
    });
    assert.equal(response.code, 429);
  });

  it('issues a challenge on elevated activity and consumes a proof exactly once', async function () {
    let used = false;
    const operations: Parameters<NonNullable<Dependencies['consume']>>[0][] =
      [];
    const middleware = createSigninChallenge({
      address: () => '192.0.2.1',
      consume: async options => {
        operations.push(options);
        if (options.operation === 'signin-account') return { allowed: false };
        const allowed = !used;
        used = true;
        return { allowed };
      },
    });
    const body: NonNullable<Request['body']> = { username: 'member' };
    const req = request(body);
    const first = res();
    let next = 0;
    await middleware(req, first, () => next++);
    assert.equal(first.code, 429);
    assert.ok(first.body?.signinChallenge);
    assert.equal(
      first.body.message,
      'An additional sign-in check is required.',
    );
    assert.equal(first.body.signinChallenge.difficulty, 14);
    body.signinProof = solve(first.body.signinChallenge);
    await middleware(req, res(), () => next++);
    assert.equal(next, 1);
    const consumed = operations[2];
    assert.equal(typeof consumed.now, 'number');
    assert.deepEqual(consumed, {
      operation: 'signin-proof',
      dimensions: [
        { name: 'proof', value: first.body.signinChallenge.token, limit: 1 },
      ],
      windowMs: 5 * 60 * 1000,
      now: consumed.now,
    });
    const replay = res();
    await middleware(req, replay, () => next++);
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
      { username: '   ' },
    ])
      await missing(request(body), res(), () => next++);
    assert.equal(next, 5);
    const response = res();
    await missing(request({ username: 'member' }), response, () => next++);
    assert.equal(response.code, 503);
    assert.deepEqual(response.body, {
      message: 'Sign-in is temporarily unavailable.',
    });
    const broken = createSigninChallenge({
      address: () => '192.0.2.1',
      consume: async () => {
        throw new Error('offline');
      },
    });
    const unavailable = res();
    await broken(request({ username: 'member' }), unavailable, () => next++);
    assert.equal(unavailable.code, 503);
    assert.deepEqual(unavailable.body, {
      message: 'Sign-in is temporarily unavailable.',
    });
    assert.equal(next, 5);
  });
});
