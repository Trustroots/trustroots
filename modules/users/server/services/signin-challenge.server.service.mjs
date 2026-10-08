import crypto from 'node:crypto';
import config from '../../../../config/config.mjs';
import limits from '../../../core/server/services/targeted-request-limits.server.service.mjs';
import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mjs';

const lifetimeMs = 120000;
function signature(value) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update('signin-challenge:' + value)
    .digest('base64url');
}
export function issueChallenge(account, ip, now = Date.now()) {
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
export function verifyChallenge(proof, account, ip, now = Date.now()) {
  if (
    !proof ||
    typeof proof.token !== 'string' ||
    proof.token.length > 2048 ||
    !Number.isSafeInteger(proof.solution) ||
    proof.solution < 0 ||
    proof.solution > 4194304
  )
    return false;
  const parts = proof.token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature(parts[0])),
      Buffer.from(parts[1]),
    )
  )
    return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  } catch {
    return false;
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
  consume = limits.consume,
  address = getClientIpAddress,
} = {}) {
  return async function signinChallenge(req, res, next) {
    const handle = req.body?.username;
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
      const proof = req.body.signinProof;
      if (verifyChallenge(proof, account, ip)) {
        const used = await consume({
          operation: 'signin-proof',
          dimensions: [{ name: 'proof', value: proof.token, limit: 1 }],
          windowMs: 5 * 60 * 1000,
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
