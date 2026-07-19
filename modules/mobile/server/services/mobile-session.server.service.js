const crypto = require('crypto');
const mongoose = require('mongoose');

const MobileSession = mongoose.model('MobileSession');

const accessTokenLifetimeMs = 15 * 60 * 1000;
const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function token() {
  return crypto.randomBytes(32).toString('hex');
}

function tokenHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function tokenPair(now = new Date()) {
  return {
    accessToken: token(),
    refreshToken: token(),
    accessExpiresAt: new Date(now.getTime() + accessTokenLifetimeMs),
    refreshExpiresAt: new Date(now.getTime() + refreshTokenLifetimeMs),
  };
}

function serialiseTokens(tokens) {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessExpiresAt.toISOString(),
  };
}

function isActiveMember(user) {
  return user && !user.roles.includes('suspended');
}

exports.create = function (user, callback) {
  const tokens = tokenPair();
  const session = new MobileSession({
    user: user._id,
    accessTokenHash: tokenHash(tokens.accessToken),
    accessExpiresAt: tokens.accessExpiresAt,
    refreshTokenHash: tokenHash(tokens.refreshToken),
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  session.save(function (err) {
    callback(err, err ? null : serialiseTokens(tokens));
  });
};

exports.findByAccessToken = function (accessToken, callback) {
  MobileSession.findOne({
    accessTokenHash: tokenHash(accessToken),
    accessExpiresAt: { $gt: new Date() },
    revokedAt: null,
  })
    .populate('user')
    .exec(callback);
};

exports.rotateRefreshToken = function (refreshToken, callback) {
  const now = new Date();
  const tokens = tokenPair(now);
  const refreshTokenHash = tokenHash(refreshToken);
  const validSession = {
    refreshTokenHash,
    refreshExpiresAt: { $gt: now },
    revokedAt: null,
  };

  MobileSession.findOne(validSession)
    .populate('user')
    .exec(function (findErr, session) {
      if (findErr || !session) {
        return callback(findErr, null, null);
      }
      if (!isActiveMember(session.user)) {
        return callback(null, null, null);
      }

      return MobileSession.findOneAndUpdate(
        { ...validSession, _id: session._id },
        {
          $set: {
            accessTokenHash: tokenHash(tokens.accessToken),
            accessExpiresAt: tokens.accessExpiresAt,
            refreshTokenHash: tokenHash(tokens.refreshToken),
            refreshExpiresAt: tokens.refreshExpiresAt,
          },
        },
        { new: true },
        function (updateErr, updatedSession) {
          if (updateErr || !updatedSession) {
            return callback(updateErr, null, null);
          }
          return callback(null, session, serialiseTokens(tokens));
        },
      );
    });
};

exports.revoke = function (session, callback) {
  session.revokedAt = new Date();
  session.save(callback);
};

exports.accessTokenLifetimeMs = accessTokenLifetimeMs;
exports.refreshTokenLifetimeMs = refreshTokenLifetimeMs;
