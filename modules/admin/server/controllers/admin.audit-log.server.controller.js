/**
 * Module dependencies.
 */
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const log = require(path.resolve('./config/lib/logger'));
const mongoose = require('mongoose');

const AuditLog = mongoose.model('AuditLog');

/**
 * This middleware stores queries to audit log
 */
exports.record = (req, res, next) => {
  // Client address when using Phusion Passenger
  // https://www.phusionpassenger.com/library/indepth/nodejs/secure_http_headers.html#passenger-client-address
  const passengerClientAddress = req.get('!~Passenger-Client-Address');
  const xForwardedFor = req.get('X-Forwarded-For');

  const auditLogItem = new AuditLog({
    body: req.body,
    ip: passengerClientAddress || xForwardedFor || req.ip,
    params: req.params,
    query: req.query,
    route: req.route.path,
    user: req.user._id,
  });

  // Save support request to db
  auditLogItem.save(error => {
    if (error) {
      log('error', 'Failed storing audit log item to the DB. #fi2fb2', {
        error,
      });
    }
    next();
  });
};

/**
 * This middleware stores queries to audit log
 */
exports.list = (req, res) => {
  AuditLog.find()
    .sort('-date')
    .limit(100)
    .populate({
      path: 'user',
      select: 'username',
      model: 'User',
    })
    .exec((err, items) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
      res.send(items || []);
    });
};
