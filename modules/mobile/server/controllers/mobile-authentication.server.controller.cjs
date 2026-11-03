const mongoose = require('mongoose');
const mobileMember = require('../presenters/mobile-member.server.presenter.cjs');
const mobileSession = require('../services/mobile-session.server.service.cjs');
const userProfile = require('../../../users/server/controllers/users.profile.server.controller.mjs');
const passwordHashing = require('../../../users/server/services/password-hashing.server.service.mjs');
const lastSeen = require('../../../users/server/controllers/users.lastseen.server.controller.mjs');

function isActiveMember(user) {
  return Boolean(user && user.roles && !user.roles.includes('suspended'));
}

const User = mongoose.model('User');
const tokenPattern = /^[a-f0-9]{64}$/;

function opaqueToken(value) {
  const token = String(value || '');
  return tokenPattern.test(token) ? token : null;
}

function bearerToken(req) {
  const authorization = req.get('Authorization') || '';
  const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : null;
}

function unauthorised(res) {
  return noStore(res).status(401).send({
    code: 'authentication_required',
    message: 'Mobile authentication is required.',
  });
}

function noStore(res) {
  return res.set('Cache-Control', 'no-store').set('Pragma', 'no-cache');
}

function buildVersion(startedAt) {
  const timestamp = new Date(startedAt).toISOString();
  const date = timestamp.slice(0, 10).replace(/-/g, '');
  const time = timestamp.slice(11, 16).replace(':', '');
  return `v0.1-${date}-${time}`;
}

exports.status = function (req, res) {
  const appSettings = req.app.locals.appSettings;
  return noStore(res).json({
    contractVersion: 'v0',
    buildVersion: buildVersion(appSettings.time),
    startedAt: appSettings.time,
  });
};

exports.authenticate = function (req, res, next) {
  const accessToken = bearerToken(req);
  if (!accessToken) {
    return unauthorised(res);
  }

  mobileSession.findByAccessToken(accessToken, function (err, session) {
    if (err) {
      return next(err);
    }
    if (
      !session ||
      !isActiveMember(session.user) ||
      (session.authVersion ?? 0) !== (session.user.authVersion ?? 0)
    ) {
      return unauthorised(res);
    }

    req.mobileSession = session;
    req.mobileUser = session.user;
    // Mobile resource controllers share established member-domain logic that
    // expects `req.user`. This assignment is confined to the bearer-only
    // mobile route tree; it never creates a browser session.
    req.user = session.user;
    return lastSeen(req, res, next);
  });
};

exports.prepareResource = function (req, res, next) {
  noStore(res);
  return next();
};

exports.validateMessageIds = function (req, res, next) {
  const messageIds = req.body.messageIds;
  if (
    !Array.isArray(messageIds) ||
    messageIds.length === 0 ||
    messageIds.length > 100 ||
    !messageIds.every(
      id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id),
    )
  ) {
    return res
      .status(400)
      .json({ message: 'Provide between 1 and 100 valid message IDs.' });
  }
  return next();
};

exports.signin = async function (req, res, next) {
  const username = String(req.body.username || '')
    .trim()
    .toLowerCase();
  const password = String(req.body.password || '');

  if (
    !username ||
    username.length > 254 ||
    !password ||
    password.length > 1024
  ) {
    try {
      await passwordHashing.verifyPassword(
        password.length > 1024 ? '' : password,
        null,
        null,
      );
      return unauthorised(res);
    } catch (error) {
      return next(error);
    }
  }

  try {
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });
    if (!user || !isActiveMember(user)) {
      await passwordHashing.verifyPassword(password, null, null);
      return unauthorised(res);
    }
    if (!(await user.authenticate(password))) {
      return unauthorised(res);
    }
    return mobileSession.create(user, function (sessionErr, tokens) {
      if (sessionErr) return next(sessionErr);
      return noStore(res).json({
        ...tokens,
        member: mobileMember.currentMember(user),
      });
    });
  } catch (error) {
    return next(error);
  }
};

exports.refresh = function (req, res, next) {
  const refreshToken = opaqueToken(req.body.refreshToken);
  if (!refreshToken) {
    return unauthorised(res);
  }

  mobileSession.rotateRefreshToken(
    refreshToken,
    function (err, session, tokens) {
      if (err) {
        return next(err);
      }
      if (
        !session ||
        !isActiveMember(session.user) ||
        (session.authVersion ?? 0) !== (session.user.authVersion ?? 0)
      ) {
        return unauthorised(res);
      }
      return noStore(res).json({
        ...tokens,
        member: mobileMember.currentMember(session.user),
      });
    },
  );
};

exports.signout = function (req, res, next) {
  mobileSession.revoke(req.mobileSession, function (err) {
    if (err) {
      return next(err);
    }
    return noStore(res).status(204).send();
  });
};

exports.me = function (req, res) {
  return noStore(res).json({
    member: mobileMember.currentMember(req.mobileUser),
  });
};

exports.loadProfile = function (req, res, next) {
  req.user = req.mobileUser;
  return userProfile.userByUsername(req, res, next, req.params.profileUsername);
};

exports.profile = function (req, res) {
  return noStore(res).json({
    profile: mobileMember.profile(req.profile, req.mobileUser),
  });
};

exports.tokenPattern = tokenPattern;
exports.buildVersion = buildVersion;
