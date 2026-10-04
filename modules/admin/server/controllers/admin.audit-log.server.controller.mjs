/**
 * Module dependencies.
 */
import errorService from '../../../core/server/services/error.server.service.js';
import log from '../../../../config/lib/logger.js';
import mongoose from 'mongoose';

const AuditLog = mongoose.model('AuditLog');
const User = mongoose.model('User');

/**
 * This middleware stores queries to audit log
 */
export const record = (req, res, next) => {
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

/** Return the latest matching entries, filtered by acting staff. */
export const list = async (req, res) => {
  const { username, team } = req.query || {};
  if (
    [username, team].some(
      value => value !== undefined && typeof value !== 'string',
    ) ||
    (team && !['admin', 'welcome-team'].includes(team))
  ) {
    return res.status(400).send({ message: 'Invalid audit log filters.' });
  }
  try {
    const criteria = {};
    if (username || team) {
      const actorCriteria = {};
      if (username) actorCriteria.username = username.trim().toLowerCase();
      if (team) actorCriteria.roles = team;
      const actors = await User.find(actorCriteria).select('_id').lean();
      criteria.user = { $in: actors.map(actor => actor._id) };
    }
    const items = await AuditLog.find(criteria)
      .sort({ date: -1, _id: -1 })
      .limit(100)
      .populate({
        path: 'user',
        select: 'username displayName roles',
        model: 'User',
      })
      .exec();
    return res.send(items || []);
  } catch (err) {
    return res.status(400).send({ message: errorService.getErrorMessage(err) });
  }
};

/** Existing actors from the whole history, independent of the current filters. */
export const actors = async (req, res) => {
  try {
    const actorIds = await AuditLog.distinct('user');
    const users = await User.find({ _id: { $in: actorIds } })
      .select('_id username displayName roles')
      .sort({ username: 1 })
      .lean();
    return res.send(users);
  } catch (err) {
    return res.status(400).send({ message: errorService.getErrorMessage(err) });
  }
};

export default { record, list, actors };
