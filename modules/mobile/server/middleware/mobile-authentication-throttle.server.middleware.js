const crypto = require('crypto');
const mongoose = require('mongoose');

const MobileAuthenticationAttempt = mongoose.model(
  'MobileAuthenticationAttempt',
);

const attemptLimit = 10;
const ipAttemptLimit = 50;
const refreshIpAttemptLimit = 100;
const attemptWindowMs = 15 * 60 * 1000;

function isLoopback(address) {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1'
  );
}

function sourceAddress(req) {
  const directAddress =
    (req.socket && req.socket.remoteAddress) ||
    (req.connection && req.connection.remoteAddress);
  const passengerAddress =
    typeof req.get === 'function'
      ? req.get('!~Passenger-Client-Address')
      : null;

  // Passenger supplies the original address over its local app connection.
  // Production runs Passenger on loopback; deployments that replace it must
  // explicitly provide an equivalent authenticated proxy boundary here.
  // Never trust the same header from a remote client, where it could be used
  // to rotate rate-limit identities.
  if (passengerAddress && isLoopback(directAddress)) {
    return passengerAddress;
  }
  return req.ip || directAddress || 'unknown';
}

function attemptKey(req, scope, identity) {
  return crypto
    .createHash('sha256')
    .update(`${scope}\n${sourceAddress(req)}\n${identity}`)
    .digest('hex');
}

function throttle(scope, identityFromRequest, limit = attemptLimit) {
  return function (req, res, next) {
    const now = new Date();
    const key = attemptKey(req, scope, identityFromRequest(req));
    const expiresAt = new Date(now.getTime() + attemptWindowMs);

    MobileAuthenticationAttempt.deleteOne({
      expiresAt: { $lte: now },
      key,
    }).exec(function (deleteErr) {
      if (deleteErr) {
        return next(deleteErr);
      }

      const increment = function (upsert, callback) {
        MobileAuthenticationAttempt.findOneAndUpdate(
          { key },
          {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt },
          },
          { new: true, setDefaultsOnInsert: true, upsert },
        ).exec(callback);
      };

      const incremented = function (incrementErr, attempt) {
        if (incrementErr && incrementErr.code === 11000) {
          return increment(false, incremented);
        }
        if (incrementErr) {
          return next(incrementErr);
        }
        if (!attempt) {
          return next(new Error('Authentication attempt was not recorded.'));
        }
        if (attempt.count > limit) {
          return res
            .set('Retry-After', String(attemptWindowMs / 1000))
            .status(429)
            .send({
              code: 'rate_limited',
              message:
                'Too many authentication attempts. Please try again later.',
            });
        }

        res.once('finish', function () {
          if (res.statusCode < 400) {
            MobileAuthenticationAttempt.deleteOne({ key }).exec();
          }
        });
        return next();
      };

      return increment(true, incremented);
    });
  };
}

const signinByAccount = throttle('signin-account', function (req) {
  return String(req.body.username || '')
    .trim()
    .toLowerCase();
});
const signinByIp = throttle(
  'signin-ip',
  function () {
    return '';
  },
  ipAttemptLimit,
);

exports.signin = function (req, res, next) {
  return signinByIp(req, res, function (err) {
    if (err) return next(err);
    return signinByAccount(req, res, next);
  });
};

const refreshByToken = throttle('refresh-token', function (req) {
  return String(req.body.refreshToken || '');
});
const refreshByIp = throttle(
  'refresh-ip',
  function () {
    return '';
  },
  refreshIpAttemptLimit,
);

exports.refresh = function (req, res, next) {
  return refreshByIp(req, res, function (err) {
    if (err) return next(err);
    return refreshByToken(req, res, next);
  });
};

exports.attemptLimit = attemptLimit;
exports.ipAttemptLimit = ipAttemptLimit;
exports.refreshIpAttemptLimit = refreshIpAttemptLimit;
exports.attemptWindowMs = attemptWindowMs;
exports.sourceAddress = sourceAddress;
