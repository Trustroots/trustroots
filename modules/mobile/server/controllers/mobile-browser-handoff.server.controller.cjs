const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../../../../config/config.mts').default;
const mobileMember = require('../presenters/mobile-member.server.presenter.cjs');
const mobileSession = require('../services/mobile-session.server.service.cjs');

const Handoff = mongoose.model('MobileBrowserHandoff');
const User = mongoose.model('User');
const confirmationPath = '/auth/mobile/confirm/';
const lifetimeMs = 5 * 60 * 1000;
const challengePattern = /^[A-Za-z0-9_-]{43}$/;
const statePattern = /^[A-Za-z0-9_-]{22,128}$/;
const requestPattern = /^[a-f0-9]{64}$/;
const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

function platformCallback(platform) {
  if (platform === 'ios') return 'org.trustroots.mobile://auth/complete';
  if (platform === 'android' && config.domain === 'www.trustroots.org') {
    return 'https://www.trustroots.org/mobile-auth/complete';
  }
  return null;
}

function matches(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}

function setPrivateHeaders(res) {
  return res
    .set('Cache-Control', 'no-store')
    .set('Referrer-Policy', 'no-referrer');
}

function page(res, status, title, content) {
  return res.status(status).type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Trustroots</title></head>
<body><main><h1>${title}</h1>${content}</main></body></html>`);
}

function unavailable(res) {
  return page(
    res,
    400,
    'Could not continue sign-in',
    '<p>Start again from the Trustroots app.</p>',
  );
}

function signinPath(id) {
  const params = new URLSearchParams({
    continue: 'true',
    returnTo: confirmationPath + id,
  });
  return `/signin?${params}`;
}

function latestBrowserUser(req, handoff) {
  const user = req.user;
  return user &&
    !user.roles.includes('suspended') &&
    req.session.browserSigninAt > handoff.createdAt.getTime() &&
    (user.mfaEnabled !== true || user.$locals.mfaVerified === true)
    ? user
    : null;
}

function pendingRequest(id) {
  return {
    _id: id,
    expiresAt: { $gt: new Date() },
    codeHash: { $exists: false },
  };
}

function digest(value, encoding) {
  return createHash('sha256').update(value).digest(encoding);
}

exports.start = async function (req, res) {
  setPrivateHeaders(res);
  const { platform, code_challenge: codeChallenge, state } = req.query;
  if (
    !platformCallback(platform) ||
    !matches(codeChallenge, challengePattern) ||
    !matches(state, statePattern)
  ) {
    return unavailable(res);
  }
  const id = randomBytes(32).toString('hex');
  const createdAt = new Date();
  await Handoff.create({
    _id: id,
    platform,
    codeChallenge,
    state,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + lifetimeMs),
  });
  return res.redirect(303, signinPath(id));
};

exports.confirmation = async function (req, res) {
  setPrivateHeaders(res);
  const { requestId } = req.params;
  if (!matches(requestId, requestPattern)) return unavailable(res);
  const handoff = await Handoff.findOne(pendingRequest(requestId));
  if (!handoff || !platformCallback(handoff.platform)) return unavailable(res);
  const user = latestBrowserUser(req, handoff);
  if (!user) return res.redirect(303, signinPath(requestId));
  const csrf = (req.session.mobileHandoffCsrf ||=
    randomBytes(32).toString('hex'));
  const platformName = handoff.platform === 'ios' ? 'iOS' : 'Android';
  // Trustroots usernames are alphanumeric, but validate legacy records too.
  const identity = /^[a-z0-9]+$/i.test(user.username)
    ? ` <strong>${user.username}</strong>`
    : '';
  // A same-origin POST needs its Origin header. The approval page has no code.
  res.set('Referrer-Policy', 'same-origin');
  return page(
    res,
    200,
    'Confirm app sign-in',
    `<p>Continue with your signed-in Trustroots account${identity} on ${platformName}.</p>
<p>Only confirm if you started sign-in in the Trustroots app.</p>
<form method="post" action="${confirmationPath}${requestId}"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Confirm app sign-in</button></form>`,
  );
};

exports.androidFallback = function (_req, res) {
  setPrivateHeaders(res);
  return page(
    res,
    200,
    'Open Trustroots on Android',
    '<p>If the app did not open, allow Trustroots to open supported links in Android Settings, then start sign-in again from the app.</p>',
  );
};

exports.issue = async function (req, res) {
  setPrivateHeaders(res);
  const { requestId } = req.params;
  const csrf = req.body?.csrf;
  const expected = req.session.mobileHandoffCsrf;
  if (
    !matches(csrf, requestPattern) ||
    !expected ||
    !timingSafeEqual(Buffer.from(csrf), Buffer.from(expected))
  ) {
    return res
      .status(403)
      .send('App sign-in confirmation expired. Start again from the app.');
  }
  if (!matches(requestId, requestPattern)) return unavailable(res);
  const handoff = await Handoff.findOne(pendingRequest(requestId));
  if (!handoff) return unavailable(res);
  const callback = platformCallback(handoff.platform);
  const user = latestBrowserUser(req, handoff);
  if (!callback || !user) return unavailable(res);

  const code = randomBytes(32).toString('base64url');
  const claimed = await Handoff.findOneAndUpdate(pendingRequest(requestId), {
    $set: {
      codeHash: digest(code, 'hex'),
      user: user._id,
      authVersion: user.authVersion ?? 0,
      mfaVerified: user.mfaEnabled === true,
    },
  });
  if (!claimed) return unavailable(res);

  const params = new URLSearchParams({ code, state: handoff.state });
  return page(
    res,
    200,
    'Return to Trustroots',
    `<p><a href="${callback}?${params.toString().replace('&', '&amp;')}">Open the Trustroots app</a></p>`,
  );
};

function invalidExchange(res) {
  return res.status(401).json({
    code: 'authentication_required',
    message: 'Start sign-in again from the Trustroots app.',
  });
}

exports.exchange = async function (req, res, next) {
  setPrivateHeaders(res);
  const { code, codeVerifier, platform } = req.body || {};
  if (
    !platformCallback(platform) ||
    !matches(code, challengePattern) ||
    !matches(codeVerifier, verifierPattern)
  ) {
    return invalidExchange(res);
  }
  const handoff = await Handoff.findOneAndDelete({
    platform,
    codeHash: digest(code, 'hex'),
    codeChallenge: digest(codeVerifier, 'base64url'),
    expiresAt: { $gt: new Date() },
  });
  if (!handoff) return invalidExchange(res);

  const user = await User.findById(handoff.user);
  if (
    !user ||
    user.roles.includes('suspended') ||
    (user.authVersion ?? 0) !== handoff.authVersion ||
    (user.mfaEnabled === true && handoff.mfaVerified !== true)
  ) {
    return invalidExchange(res);
  }
  return mobileSession.createBrowserVerified(
    user,
    handoff.mfaVerified === true,
    (error, tokens) => {
      if (error) return next(error);
      return res.json({ ...tokens, member: mobileMember.currentMember(user) });
    },
  );
};
