import errorService from '../../../core/server/services/error.server.service.mjs';
import paginationService from '../../../core/server/services/pagination.server.service.mjs';
import mongoose from 'mongoose';
import moment from 'moment';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';
const service = {};

/**
 * Module dependencies.
 */
const Tribe = mongoose.model('Tribe');
const User = mongoose.model('User');
const Contact = mongoose.model('Contact');
const Experience = mongoose.model('Experience');
const MEMBER_ONLY_TRIBE_SLUGS = ['naturists'];

// Publicly exposed fields from tribes
service.tribeFields = [
  '_id',
  'slug',
  'label',
  'count',
  'color',
  'image',
  'attribution',
  'attribution_url',
  'description',
  'created',
].join(' ');

/**
 * Populate options for the tribe of a member document
 * @param select String Fields to select, defaults to `tribeFields`
 * @return Object Mongoose populate options
 */
service.tribePopulateOptions = function (select = service.tribeFields) {
  return {
    path: 'member.tribe',
    select,
    model: 'Tribe',
    // Not possible at the moment due bug in Mongoose
    // http://mongoosejs.com/docs/faq.html#populate_sort_order
    // https://github.com/Automattic/mongoose/issues/2202
    // options: { sort: { count: -1 } }
  };
};

function visibleTribesQuery(req) {
  const query = {
    public: true,
  };
  if (!req.user) {
    query.slug = {
      $nin: MEMBER_ONLY_TRIBE_SLUGS,
    };
  }
  return query;
}

/**
 * List all tribes
 */
service.listTribes = function (req, res) {
  // Sort either by count or alphabetically
  const sort =
    req?.query?.sortBy === 'alphabetically'
      ? {
          label: 'desc',
        }
      : {
          count: 'desc',
        };
  const page = parseInt(req.query.page, 10) || 1;
  const limitMatch = req.originalUrl?.match(/limit=(\d+)/);
  const limit = limitMatch
    ? parseInt(limitMatch[1], 10)
    : parseInt(req.query.limit, 10) || 0;
  const query = visibleTribesQuery(req);
  Tribe.find(query)
    .select(service.tribeFields)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .exec(function (err, docs) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
      Tribe.countDocuments(query, function (countErr, total) {
        if (countErr) {
          return errorService.sendBadRequest(res, countErr);
        }
        const pages = Math.ceil(total / limit);
        if (pages > page) {
          paginationService.setLinkHeader(req, res, pages, { relative: true });
        }
        res.json(docs);
      });
    });
};

/**
 * Return tribe
 */
service.getTribe = function (req, res) {
  res.json(req.tribe || {});
};

function visibleMemberMatch(req, excludedIDs = [], prefix = '') {
  return {
    [`${prefix}_id`]: {
      $nin: [req.user._id, ...(req.user.blocked || []), ...excludedIDs],
    },
    [`${prefix}public`]: true,
    [`${prefix}roles`]: { $nin: userRolesService.restrictedMessagingRoles },
    [`${prefix}blocked`]: { $nin: [req.user._id] },
    [`${prefix}member.tribe`]: req.tribe._id,
  };
}

const DISCOVERY_QUERY_TIMEOUT_MS = 1000;

async function listCircleContacts(req) {
  const selfId = req.user._id;
  return Contact.aggregate([
    {
      $match: {
        confirmed: true,
        $or: [{ userFrom: selfId }, { userTo: selfId }],
      },
    },
    {
      $project: {
        userId: {
          $cond: [{ $eq: ['$userFrom', selfId] }, '$userTo', '$userFrom'],
        },
      },
    },
    { $group: { _id: '$userId' } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: visibleMemberMatch(req, [], 'user.') },
    { $sort: { 'user.displayName': 1, 'user._id': 1 } },
    { $limit: 20 },
    { $project: userMiniService.userMiniProjection('$user') },
  ])
    .option({ maxTimeMS: DISCOVERY_QUERY_TIMEOUT_MS })
    .exec();
}

async function listCircleRecommenders(req, excludedIDs) {
  const selfId = req.user._id;
  return Experience.aggregate([
    {
      $match: {
        userTo: selfId,
        userFrom: {
          $nin: [selfId, ...(req.user.blocked || []), ...excludedIDs],
        },
        public: true,
        recommend: 'yes',
      },
    },
    { $sort: { created: -1 } },
    { $group: { _id: '$userFrom', created: { $first: '$created' } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: visibleMemberMatch(req, excludedIDs, 'user.') },
    { $sort: { created: -1, _id: 1 } },
    { $limit: 20 },
    { $project: userMiniService.userMiniProjection('$user') },
  ])
    .option({ maxTimeMS: DISCOVERY_QUERY_TIMEOUT_MS })
    .exec();
}

/** List a signed-in circle member's bounded, privacy-filtered discovery groups. */
service.listMembers = async function listMembers(req, res, next) {
  try {
    const isMember = req.user?.member?.some(member =>
      member.tribe.equals(req.tribe._id),
    );
    if (!isMember) {
      return errorService.sendForbidden(res);
    }

    const contacts = await listCircleContacts(req);
    const contactIDs = contacts.map(member => member._id);
    const recommenders = await listCircleRecommenders(req, contactIDs);
    const recommenderIDs = recommenders.map(member => member._id);
    const active = await User.find({
      ...visibleMemberMatch(req, [...contactIDs, ...recommenderIDs]),
      seen: { $gte: moment().subtract(1, 'month').toDate() },
    })
      .select(userMiniService.userMiniProfileFields)
      .sort({ seen: -1, _id: 1 })
      .limit(8)
      .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
      .lean()
      .exec();

    return res.json({ contacts, recommenders, active });
  } catch (err) {
    return next(err);
  }
};

/**
 * Tribe middleware
 */
service.tribeBySlug = function (req, res, next, slug) {
  if (!req.user && MEMBER_ONLY_TRIBE_SLUGS.includes(slug)) {
    return errorService.sendForbidden(res);
  }
  Tribe.findOne(
    {
      public: true,
      slug,
    },
    service.tribeFields,
  ).exec(function (err, tribe) {
    if (err) {
      return errorService.sendBadRequest(res, err);
    } else {
      req.tribe = tribe;
      return next();
    }
  });
};

/**
 * Update cached member count for a tribe
 *
 * @param {string} id - the id of the tribe
 * @param {boolean} returnUpdated - should callback contain updated document?
 * @param {int} difference - how much to add or remove (negative) from the tribe.count?
 * @param {function} callback
 */
service.updateCount = function (id, difference, returnUpdated, callback) {
  Tribe.findByIdAndUpdate(
    id,
    {
      $inc: {
        count: parseInt(difference),
      },
    },
    {
      safe: false,
      // @link http://stackoverflow.com/a/4975054/1984644
      new: Boolean(returnUpdated), // get the updated document in return?
    },
    callback,
  );
};
const getTribe = service.getTribe;
const listMembers = service.listMembers;
const listTribes = service.listTribes;
const tribeBySlug = service.tribeBySlug;
const tribeFields = service.tribeFields;
const tribePopulateOptions = service.tribePopulateOptions;
const updateCount = service.updateCount;
export {
  getTribe as getTribe,
  listMembers as listMembers,
  listTribes as listTribes,
  tribeBySlug as tribeBySlug,
  tribeFields as tribeFields,
  tribePopulateOptions as tribePopulateOptions,
  updateCount as updateCount,
};
export default service;
export { service as 'module.exports' };
