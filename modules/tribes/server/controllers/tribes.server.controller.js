/**
 * Module dependencies.
 */
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
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
  Tribe.paginate(
    {
      public: true,
    },
    {
      page: parseInt(req.query.page, 10) || 1, // Note: `parseInt('0')` will return `NaN`, `page` will be set to `1` in such case.
      limit: parseInt(req.query.limit, 10) || 0, // `0` for infinite
      sort: {
        count: 'desc',
      },
      select: exports.tribeFields,
    },
    function (err, data) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      } else {
        // Pass pagination data to construct link header
        setLinkHeader(req, res, data.pages);

        res.json(data.docs);
      }
    },
  );
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
