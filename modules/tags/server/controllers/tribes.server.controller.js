'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    paginate = require('express-paginate'),
    mongoose = require('mongoose'),
    Tag = mongoose.model('Tag');

// Publicly exposed fields from tribes
exports.tribeFields = [
  '_id',
  'slug',
  'label',
  'count',
  'color',
  'image_UUID',
  'attribution',
  'attribution_url',
  'tribe',
  'description'
].join(' ');

/**
 * Constructs link headers for pagination
 */
var setLinkHeader = function(req, res, pageCount) {
  if (paginate.hasNextPages(req)(pageCount)) {
    var nextPage = { page: req.query.page + 1 };
    var linkHead = '<' + req.protocol + ':' + res.locals.url.slice(0, -1) + res.locals.paginate.href(nextPage) + '>; rel="next"';
    res.set('Link', linkHead);
  }
};

/**
 * List all tribes
 */
exports.listTribes = function(req, res) {

  Tag.paginate(
    {
      public: true,
      tribe: true
    },
    {
      page: parseInt(req.query.page, 10) || 1, // Note: `parseInt('0')` will return `NaN`, `page` will be set to `1` in such case.
      limit: parseInt(req.query.limit, 10) || 0, // `0` for infinite
      sort: {
        count: 'desc'
      },
      select: exports.tribeFields
    },
    function(err, data) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err)
        });
      } else {
        // Pass pagination data to construct link header
        setLinkHeader(req, res, data.pages);

        res.json(data.docs);
      }
    }
  );
};

/**
 * Return tribe
 */
exports.getTribe = function(req, res) {
  res.json(req.tribe || {});
};

/**
 * Tribe middleware
 */
exports.tribeBySlug = function(req, res, next, slug) {
  Tag.findOne(
    {
      public: true,
      tribe: true,
      slug: slug
    },
    exports.tribeFields
  )
  .exec(function(err, tribe) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    } else {
      req.tribe = tribe;
      return next();
    }
  });
};
