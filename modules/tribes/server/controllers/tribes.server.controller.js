/**
 * Module dependencies.
 */
const errorService = require('../../../core/server/services/error.server.service');
const paginate = require('express-paginate');
const mongoose = require('mongoose');
const Tribe = mongoose.model('Tribe');

// Publicly exposed fields from tribes
exports.tribeFields = [
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
 * Constructs link headers for pagination
 */
const setLinkHeader = function (req, res, pageCount) {
  if (paginate.hasNextPages(req)(pageCount)) {
    const nextPage = { page: req.query.page + 1 };
    const linkHead =
      '<' +
      req.protocol +
      ':' +
      res.locals.url.slice(0, -1) +
      res.locals.paginate.href(nextPage) +
      '>; rel="next"';
    res.set('Link', linkHead);
  }
};

/**
 * List all tribes
 */
exports.listTribes = function (req, res) {
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

  Tribe.find({ public: true })
    .select(exports.tribeFields)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .exec(function (err, docs) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
      Tribe.countDocuments({ public: true }, function (countErr, total) {
        if (countErr) {
          return res.status(400).send({
            message: errorService.getErrorMessage(countErr),
          });
        }
        const pages = Math.ceil(total / limit);
        if (pages > page) {
          setLinkHeader(req, res, pages);
        }
        res.json(docs);
      });
    });
};

/**
 * Return tribe
 */
exports.getTribe = function (req, res) {
  res.json(req.tribe || {});
};

/**
 * Tribe middleware
 */
exports.tribeBySlug = function (req, res, next, slug) {
  Tribe.findOne(
    {
      public: true,
      slug,
    },
    exports.tribeFields,
  ).exec(function (err, tribe) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
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
exports.updateCount = function (id, difference, returnUpdated, callback) {
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
