import crypto from 'node:crypto';
import config from '../../../../config/config.mts';
import { consume as defaultConsume } from '../../../core/server/services/targeted-request-limits.server.service.mts';
import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mts';

interface SigninProof {
  token?: unknown;
  solution?: unknown;
}

interface SigninChallenge {
  token: string;
  difficulty: number;
}

interface SigninChallengeBody {
  message: string;
  signinChallenge?: SigninChallenge;
}

type SigninChallengeRequest = Parameters<typeof getClientIpAddress>[0] & {
  body?: { username?: unknown; signinProof?: SigninProof };
};

interface SigninChallengeResponse {
  status(code: number): SigninChallengeResponse;
  send(body: SigninChallengeBody): unknown;
}

interface SigninChallengeDependencies {
  consume?: (
    options: Parameters<typeof defaultConsume>[0],
  ) => Promise<{ allowed: boolean }>;
  address?: (request: SigninChallengeRequest) => string | undefined;
}

const lifetimeMs = 120000;

function signature(value: string) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update('signin-challenge:' + value)
    .digest('base64url');
}
export function issueChallenge(
  account: string,
  ip: string,
  now = Date.now(),
): SigninChallenge {
  const payload = Buffer.from(
    JSON.stringify({
      account: signature(account),
      ip: signature(ip),
      expires: Math.min(
        now + lifetimeMs,
        (Math.floor(now / 300000) + 1) * 300000,
      ),
      nonce: crypto.randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');
  return { token: payload + '.' + signature(payload), difficulty: 14 };
}
const isSafeInteger = Number.isSafeInteger as (
  value: unknown,
) => value is number;

export function isSigninProof(
  proof: SigninProof | null | undefined,
): proof is { token: string; solution: number } {
  return (
    !!proof &&
    typeof proof.token === 'string' &&
    proof.token.length <= 2048 &&
    isSafeInteger(proof.solution) &&
    proof.solution >= 0 &&
    proof.solution <= 4194304
  );
}

export function verifyChallenge(
  proof: SigninProof | null | undefined,
  account: string,
  ip: string,
  now = Date.now(),
): proof is { token: string; solution: number } {
  if (!isSigninProof(proof)) return false;

  const parts = proof.token.split('.');
  if (parts.length !== 2) return false;

  const suppliedSignature = Buffer.from(parts[1]);
  const expectedSignature = Buffer.from(signature(parts[0]));
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, suppliedSignature)
  )
    return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  } catch {
    // A signed but malformed payload leaves no claims to verify.
  }
  if (
    !payload ||
    payload.account !== signature(account) ||
    payload.ip !== signature(ip) ||
    !Number.isSafeInteger(payload.expires) ||
    payload.expires <= now ||
    payload.expires > now + lifetimeMs
  )
    return false;
  const digest = crypto
    .createHash('sha256')
    .update(proof.token + ':' + proof.solution)
    .digest();
  return digest[0] === 0 && (digest[1] & 252) === 0;
}

export function createSigninChallenge({
  consume = defaultConsume,
  address = getClientIpAddress,
}: SigninChallengeDependencies = {}) {
  return async function signinChallenge(
    req: SigninChallengeRequest,
    res: SigninChallengeResponse,
    next: () => void,
  ) {
    const { username: handle, signinProof: proof } = req.body ?? {};
    const account =
      typeof handle === 'string' && handle.length <= 320
        ? handle.trim().toLowerCase()
        : '';
    if (!account) return next();
    const ip = address(req);
    if (!ip)
      return res
        .status(503)
        .send({ message: 'Sign-in is temporarily unavailable.' });
    try {
      const attempts = await consume({
        operation: 'signin-account',
        dimensions: [{ name: 'account', value: account, limit: 20 }],
        windowMs: 15 * 60 * 1000,
      });
      if (attempts.allowed) return next();
      const now = Date.now();
      if (verifyChallenge(proof, account, ip, now)) {
        const used = await consume({
          operation: 'signin-proof',
          dimensions: [{ name: 'proof', value: proof.token, limit: 1 }],
          windowMs: 5 * 60 * 1000,
          now,
        });
        if (used.allowed) return next();
      }
      return res.status(429).send({
        message: 'An additional sign-in check is required.',
        signinChallenge: issueChallenge(account, ip),
      });
    } catch {
      return res
        .status(503)
        .send({ message: 'Sign-in is temporarily unavailable.' });
    }
  };
}
export default createSigninChallenge();
