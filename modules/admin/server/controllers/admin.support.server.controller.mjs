import mongoose from 'mongoose';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories.js';

const SupportRequest = mongoose.model('SupportRequest');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const Experience = mongoose.model('Experience');
const AuditLog = mongoose.model('AuditLog');
const PAGE_SIZE = 50;
const REQUEST_FIELDS =
  '_id category user reportedUser sent email username message reportMember status resolvedAt resolvedBy';
const MEMBER_FIELDS =
  '_id username displayName email emailTemporary public roles created description tagline locationLiving locationFrom languages removeProfileToken';

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}
function pageNumber(query) {
  const value = query.page === undefined ? '1' : query.page;
  // The shared pagination middleware normalises HTTP query values to numbers.
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^[1-9]\d{0,5}$/.test(String(value))
  ) {
    throw invalid('Invalid page.');
  }
  return Number(value);
}
function objectId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw invalid('Invalid ID.');
  }
  return value;
}
function handler(action) {
  return async (req, res) => {
    try {
      return await action(req, res);
    } catch (error) {
      return res.status(error.status || 500).send({
        message: error.status
          ? error.message
          : 'Unable to load support information.',
      });
    }
  };
}
async function audit(req) {
  // Never log report text, note text or private messages. Fail closed on storage errors.
  await new AuditLog({
    user: req.user._id,
    route: req.route.path,
    params: req.params,
    query: req.query,
    body: req.body?.status ? { status: req.body.status } : {},
  }).save();
}
async function requestById(req) {
  const report = await SupportRequest.findById(objectId(req.params.requestId))
    .select(REQUEST_FIELDS)
    .lean();
  if (!report)
    throw Object.assign(new Error('Support request not found.'), {
      status: 404,
    });
  return report;
}
function memberPayload(member) {
  const { removeProfileToken, ...safe } = member;
  return { ...safe, pendingDeletion: Boolean(removeProfileToken) };
}

export const list = handler(async (req, res) => {
  const page = pageNumber(req.query);
  const { category, status = 'open' } = req.query;
  if (
    !['all', 'open', 'resolved'].includes(status) ||
    (category !== undefined &&
      (typeof category !== 'string' ||
        !Object.hasOwn(SUPPORT_CATEGORIES, category)))
  ) {
    throw invalid('Invalid support filters.');
  }
  const criteria = category ? { category } : {};
  if (status === 'open')
    criteria.$or = [{ status: 'open' }, { status: { $exists: false } }];
  if (status === 'resolved') criteria.status = 'resolved';
  const items = await SupportRequest.find(criteria)
    .select(REQUEST_FIELDS)
    .sort({ sent: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();
  await audit(req);
  return res.send({
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  });
});

export const detail = handler(async (req, res) => {
  const report = await requestById(req);
  await audit(req);
  return res.send(report);
});

export const setStatus = handler(async (req, res) => {
  if (!['open', 'resolved'].includes(req.body.status))
    throw invalid('Invalid status.');
  const report = await requestById(req);
  await audit(req);
  await SupportRequest.updateOne(
    { _id: report._id },
    {
      $set: {
        status: req.body.status,
        resolvedAt: req.body.status === 'resolved' ? new Date() : null,
        resolvedBy: req.body.status === 'resolved' ? req.user._id : null,
      },
    },
  );
  return res.send({ status: req.body.status });
});

export const investigation = handler(async (req, res) => {
  const page = pageNumber(req.query);
  const report = await requestById(req);
  if (
    report.category !== 'reportMember' ||
    !report.user ||
    !report.reportedUser ||
    report.user.toString() === report.reportedUser.toString()
  ) {
    throw Object.assign(new Error('This report has no verified member pair.'), {
      status: 403,
    });
  }
  const { kind } = req.params;
  if (!['messages', 'experiences'].includes(kind))
    throw invalid('Invalid investigation type.');
  const criteria = {
    $or: [
      { userFrom: report.user, userTo: report.reportedUser },
      { userFrom: report.reportedUser, userTo: report.user },
    ],
  };
  const Model = kind === 'messages' ? Message : Experience;
  const fields =
    kind === 'messages'
      ? '_id created content userFrom userTo shadowHidden'
      : '_id created userFrom userTo public recommend interactions feedbackPublic';
  const items = await Model.find(criteria)
    .select(fields)
    .sort({ created: 1, _id: 1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .populate('userFrom userTo', 'username displayName')
    .lean();
  await audit(req);
  return res.send({
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  });
});

export const searchMembers = handler(async (req, res) => {
  const { search } = req.query;
  if (
    typeof search !== 'string' ||
    search.trim().length < 3 ||
    search.length > 254
  ) {
    throw invalid('Enter at least three characters.');
  }
  const pattern = new RegExp(
    search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i',
  );
  const members = await User.find({
    $or: ['username', 'displayName', 'email', 'emailTemporary'].map(field => ({
      [field]: pattern,
    })),
  })
    .select(MEMBER_FIELDS)
    .sort({ username: 1 })
    .limit(PAGE_SIZE)
    .lean();
  await audit(req);
  return res.send(members.map(memberPayload));
});

export const member = handler(async (req, res) => {
  const result = await User.findById(objectId(req.params.memberId))
    .select(MEMBER_FIELDS)
    .lean();
  if (!result)
    throw Object.assign(new Error('Member not found.'), { status: 404 });
  await audit(req);
  return res.send(memberPayload(result));
});

const api = { list, detail, setStatus, investigation, searchMembers, member };
export default api;
export { api as 'module.exports' };
