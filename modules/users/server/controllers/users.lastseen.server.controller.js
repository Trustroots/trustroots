/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const moment = require('moment');
const net = require('net');
const User = mongoose.model('User');
const config = require('../../../../config/config');

function getClientIpAddress(req) {
  // Passenger creates this secure header after Nginx has restored a Cloudflare
  // visitor address. Do not trust ordinary forwarding headers from clients.
  const passengerClientAddress = req.get('!~Passenger-Client-Address');
  const clientIpAddress = passengerClientAddress || req.ip;

  return net.isIP(clientIpAddress) ? clientIpAddress : undefined;
}

/**
 * When user is logged in, update her last seen to Now in database
 */
module.exports = function (req, res, next) {
  // is user logged in?
  if (req.user) {
    // has enough time passed since the last update?
    const expectedTimeToPass = moment
      .duration(config.limits.timeToUpdateLastSeenUser)
      .asMilliseconds();
    const isTimePassed =
      !req.user.seen ||
      Date.now() - req.user.seen.getTime() > expectedTimeToPass;
    const clientIpAddress = getClientIpAddress(req);
    const hasChangedIpAddress =
      clientIpAddress && clientIpAddress !== req.user.lastIpAddress;
    if (isTimePassed || hasChangedIpAddress) {
      // Keep the activity timestamp rate-limited, but never leave a changed
      // address stale merely because the last-seen interval has not elapsed.
      const update = {};
      if (isTimePassed) {
        update.seen = new Date();
      }
      if (hasChangedIpAddress) {
        update.lastIpAddress = clientIpAddress;
      }
      User.findByIdAndUpdate(req.user.id, update, function (err) {
        return next(err);
      });
    } else {
      return next();
    }
  } else {
    return next();
  }
};

module.exports.getClientIpAddress = getClientIpAddress;
