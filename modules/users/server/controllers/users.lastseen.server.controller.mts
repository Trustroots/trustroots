import mongoose, { type UpdateQuery } from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import net from 'net';
import config from './../../../../config/config.mts';
import type {
  UserServerDocument,
  UserServerRecord,
} from '../models/user.server.types.mts';

/**
 * Module dependencies.
 */

interface LastSeenRequest extends Request {
  user?: UserServerDocument;
  memberView?: boolean;
}

const User = mongoose.model<UserServerRecord>('User');
function getClientIpAddress(req: Request): string | undefined {
  // Passenger creates this secure header after Nginx has restored a Cloudflare
  // visitor address. Do not trust ordinary forwarding headers from clients.
  const passengerClientAddress = req.get('!~Passenger-Client-Address');
  const clientIpAddress = passengerClientAddress || req.ip;
  return typeof clientIpAddress === 'string' && net.isIP(clientIpAddress)
    ? clientIpAddress
    : undefined;
}

/**
 * When user is logged in, update her last seen to Now in database
 */
const defaultExport = function (
  req: LastSeenRequest,
  _res: Response,
  next: NextFunction,
): void {
  // is user logged in?
  if (req.user && !req.memberView) {
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
      const update: UpdateQuery<UserServerRecord> = {};
      if (isTimePassed) {
        update.seen = new Date();
      }
      if (hasChangedIpAddress) {
        update.lastIpAddress = clientIpAddress;
      }
      User.findByIdAndUpdate(req.user.id, update).then(function () {
        next();
      }, next);
    } else {
      return next();
    }
  } else {
    return next();
  }
};
defaultExport.getClientIpAddress = getClientIpAddress;
export default defaultExport;
export { getClientIpAddress };
export { defaultExport as 'module.exports' };
