const crypto = require('crypto');
const mongoose = require('mongoose');

const MobileSession = mongoose.model('MobileSession');

function isActiveMember(user) {
  return Boolean(user && user.roles && !user.roles.includes('suspended'));
}

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

exports.create = function (user, callback) {
  const tokens = tokenPair();
  const session = new MobileSession({
    user: user._id,
    authVersion: user.authVersion ?? 0,
    accessTokenHash: tokenHash(tokens.accessToken),
    accessExpiresAt: tokens.accessExpiresAt,
    refreshTokenHash: tokenHash(tokens.refreshToken),
    refreshExpiresAt: tokens.refreshExpiresAt,
  });

  session.save().then(
    () => callback(null, serialiseTokens(tokens)),
    error => callback(error, null),
  );
};

exports.findByAccessToken = function (accessToken, callback) {
  MobileSession.findOne({
    accessTokenHash: tokenHash(accessToken),
    accessExpiresAt: { $gt: new Date() },
    revokedAt: null,
  })
    .populate('user')
    .then(
      session => callback(null, session),
      error => callback(error, null),
    );
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
    .then(
      function (session) {
        if (!session) {
          return exports.revokeForRefreshTokenReuse(refreshTokenHash, callback);
        }
        if (
          !isActiveMember(session.user) ||
          (session.authVersion ?? 0) !== (session.user.authVersion ?? 0)
        ) {
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
            $addToSet: { rotatedRefreshTokenHashes: refreshTokenHash },
          },
          { new: true },
        ).then(
          updatedSession => {
            if (!updatedSession) {
              return exports.revokeForRefreshTokenReuse(
                refreshTokenHash,
                callback,
              );
            }
            return callback(null, session, serialiseTokens(tokens));
          },
          error => callback(error, null, null),
        );
      },
      error => callback(error, null, null),
    );
};

exports.revokeForRefreshTokenReuse = function (refreshTokenHash, callback) {
  MobileSession.findOneAndUpdate(
    {
      rotatedRefreshTokenHashes: refreshTokenHash,
      refreshExpiresAt: { $gt: new Date() },
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } },
    { new: true },
  ).then(
    () => callback(null, null, null),
    error => callback(error, null, null),
  );
};

exports.revoke = function (session, callback) {
  session.revokedAt = new Date();
  session.save().then(
    () => callback(null),
    error => callback(error),
  );
};

exports.accessTokenLifetimeMs = accessTokenLifetimeMs;
exports.refreshTokenLifetimeMs = refreshTokenLifetimeMs;
