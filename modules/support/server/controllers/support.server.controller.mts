/**
 * Module dependencies.
 */
import textService from './../../../core/server/services/text.server.service.mjs';
import emailService from './../../../core/server/services/email.server.service.mjs';
import statService from './../../../stats/server/services/stats.server.service.mts';
import log from './../../../../config/lib/logger.mjs';
import config from './../../../../config/config.mjs';
import mongoose, { type Types } from 'mongoose';
import validator from 'validator';
import { SUPPORT_CATEGORIES } from '../../shared/categories.ts';
import type { SupportRequestRecord } from '../models/support.server.model.mts';

interface SupportUser {
  _id: Types.ObjectId | string;
  username: string;
  email: string;
  emailTemporary?: string;
  displayName?: string;
  public?: boolean;
  created?: Date;
}

interface SupportRequestInput {
  category?: unknown;
  reportMember?: unknown;
  message?: unknown;
  username?: unknown;
  email?: unknown;
}

interface SupportRequestHandlerRequest {
  body: SupportRequestInput;
  user?: SupportUser;
  headers: { 'user-agent'?: string };
  app?: { locals?: { appSettings?: { build?: string } } };
}

interface SupportResponse {
  status(code: number): SupportResponse;
  send(body: { message: string }): SupportResponse;
  json(body: { message: string }): SupportResponse;
}

interface SupportService {
  supportRequest(
    req: SupportRequestHandlerRequest,
    res: SupportResponse,
  ): Promise<unknown>;
}

function isSupportCategory(
  value: unknown,
): value is keyof typeof SUPPORT_CATEGORIES {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPORT_CATEGORIES, value)
  );
}

const SupportRequest = mongoose.model<SupportRequestRecord>('SupportRequest');
const User = mongoose.model<{ _id: Types.ObjectId }>('User');

function plainText(value: unknown): string {
  return textService.plainText(value as string, false);
}

/**
 * Send support request to our support systems
 */
export const supportRequest: SupportService['supportRequest'] = async function (
  req,
  res,
) {
  const category =
    req.body.category === undefined
      ? req.body.reportMember
        ? 'reportMember'
        : 'other'
      : req.body.category;
  if (!isSupportCategory(category)) {
    return res.status(400).send({
      message: 'Please select a valid support category.',
    });
  }
  const build =
    req.app &&
    req.app.locals &&
    req.app.locals.appSettings &&
    req.app.locals.appSettings.build;

  // Prepare support request variables for the email template
  const supportRequestData = {
    category,
    message: req.body.message ? plainText(req.body.message) : '—',
    username: req.user ? req.user.username : plainText(req.body.username),
    email: req.user ? req.user.email : plainText(req.body.email),
    emailTemp:
      req.user && req.user.emailTemporary ? req.user.emailTemporary : false,
    displayName: req.user ? req.user.displayName : '-',
    userId: req.user ? req.user._id.toString() : '-',
    userAgent:
      req.headers && req.headers['user-agent']
        ? plainText(req.headers['user-agent'])
        : '—',
    authenticated: req.user ? 'yes' : 'no',
    profilePublic: req.user && req.user.public ? 'yes' : 'no',
    // Authenticated persisted users always have `created`; legacy test fixtures type it as optional.
    signupDate: req.user ? (req.user.created as Date).toString() : '-',
    reportMember:
      category === 'reportMember' && req.body.reportMember
        ? plainText(req.body.reportMember)
        : false,
    build: build || false,
  };
  const replyTo: { address: string; name?: string } = {
    // Trust registered user's email, otherwise validate it
    // Default to TO-support email
    address:
      req.user || validator.isEmail(supportRequestData.email)
        ? supportRequestData.email
        : config.supportEmail,
  };

  // Add name to sender if we have it
  if (req.user) {
    replyTo.name = req.user.displayName;
  }

  // Backup support request for storing it to db
  const storedSupportRequestData: Pick<
    SupportRequestRecord,
    'category' | 'userAgent' | 'username' | 'email' | 'message'
  > &
    Partial<
      Pick<SupportRequestRecord, 'user' | 'reportedUser' | 'reportMember'>
    > = {
    category,
    userAgent: supportRequestData.userAgent,
    username: supportRequestData.username,
    email: supportRequestData.email,
    message: supportRequestData.message,
  };
  if (req.user) {
    storedSupportRequestData.user = req.user._id as Types.ObjectId;
  }
  if (category === 'reportMember' && req.user) {
    if (
      typeof req.body.reportMember !== 'string' ||
      !req.body.reportMember.trim()
    ) {
      return res.status(400).send({ message: 'Select a member to report.' });
    }
    let target;
    try {
      target = await User.findOne({
        username: req.body.reportMember.trim().toLowerCase(),
      }).select('_id');
    } catch {
      return res
        .status(500)
        .send({ message: 'Unable to verify the reported member.' });
    }
    if (!target || target._id.equals(req.user._id as Types.ObjectId)) {
      return res
        .status(400)
        .send({ message: 'Select another existing member to report.' });
    }
    storedSupportRequestData.reportedUser = target._id;
  }
  if (
    supportRequestData.reportMember &&
    typeof supportRequestData.reportMember === 'string'
  ) {
    storedSupportRequestData.reportMember = supportRequestData.reportMember;
  }
  const supportRequest = new SupportRequest(storedSupportRequestData);

  // Save support request to db
  try {
    await supportRequest.save();
  } catch (dbErr: unknown) {
    if (dbErr) {
      log('error', 'Failed storing support request to the DB. #39ghsa', {
        error: dbErr,
      });
    }
  }

  // Send email
  emailService.sendSupportRequest(
    replyTo,
    supportRequestData,
    function (emailServiceErr: Error | null) {
      if (emailServiceErr) {
        log('error', 'Failed sending support request via email. #49ghsd', {
          error: emailServiceErr,
        });
        return res.status(400).send({
          message:
            'Failure while sending your support request. Please try again.',
        });
      }
      res.json({
        message: 'Support request sent.',
      });
      const statsObject = {
        namespace: 'supportRequest',
        counts: {
          count: 1,
        },
        tags: {
          authenticated: supportRequestData.authenticated,
          category,
          type: supportRequestData.reportMember ? 'reportMember' : 'normal',
        },
      };
      statService.stat(statsObject, function () {
        log('info', 'Support request processed and recorded to stats. #2hfsgh');
      });
    },
  );
};
const defaultInterop = {
  supportRequest,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
