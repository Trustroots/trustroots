const mongoose = require('mongoose');
const mobileMember = require('../presenters/mobile-member.server.presenter');
const mobileSession = require('../services/mobile-session.server.service');
const userProfile = require('../../../users/server/controllers/users.profile.server.controller');

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

function isActiveMember(user) {
  return user && !user.roles.includes('suspended');
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
    revision: appSettings.commit || null,
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
    if (!session || !isActiveMember(session.user)) {
      return unauthorised(res);
    }

    req.mobileSession = session;
    req.mobileUser = session.user;
    // Mobile resource controllers share established member-domain logic that
    // expects `req.user`. This assignment is confined to the bearer-only
    // mobile route tree; it never creates a browser session.
    req.user = session.user;
    return next();
  });
};

exports.prepareResource = function (req, res, next) {
  noStore(res);
  return next();
};

exports.signin = function (req, res, next) {
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
    return unauthorised(res);
  }

  User.findOne({
    $or: [{ username }, { email: username }],
  }).exec(function (err, user) {
    if (err) {
      return next(err);
    }
    if (!isActiveMember(user) || !user.authenticate(password)) {
      return unauthorised(res);
    }

    return mobileSession.create(user, function (sessionErr, tokens) {
      if (sessionErr) {
        return next(sessionErr);
      }
      return noStore(res).json({
        ...tokens,
        member: mobileMember.currentMember(user),
      });
    });
  });
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
      if (!session || !isActiveMember(session.user)) {
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
