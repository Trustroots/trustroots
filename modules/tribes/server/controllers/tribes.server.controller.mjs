import errorService from '../../../core/server/services/error.server.service.js';
import paginationService from '../../../core/server/services/pagination.server.service.js';
import mongoose from 'mongoose';

const service = {};

/**
 * Module dependencies.
 */
const Tribe = mongoose.model('Tribe');

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

function visibleTribesQuery(req) {
  const query = { public: true };

  if (!req.user) {
    query.slug = { $nin: MEMBER_ONLY_TRIBE_SLUGS };
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
      ? { label: 'desc' }
      : { count: 'desc' };

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
    { $inc: { count: parseInt(difference) } },
    {
      safe: false, // @link http://stackoverflow.com/a/4975054/1984644
      new: Boolean(returnUpdated), // get the updated document in return?
    },
    callback,
  );
};

const getTribe = service.getTribe;
const listTribes = service.listTribes;
const tribeBySlug = service.tribeBySlug;
const tribeFields = service.tribeFields;
const updateCount = service.updateCount;
export {
  getTribe as getTribe,
  listTribes as listTribes,
  tribeBySlug as tribeBySlug,
  tribeFields as tribeFields,
  updateCount as updateCount,
};
export default service;
