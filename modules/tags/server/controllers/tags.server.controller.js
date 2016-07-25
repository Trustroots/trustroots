'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    mongoose = require('mongoose'),
    Tag = mongoose.model('Tag');

// Publicly exposed fields from tags
exports.tagFields = [
  '_id',
  'slug',
  'label',
  'count'
].join(' ');

/**
 * Crate a tag
 */
exports.createTag = function(req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // @todo
  return res.status(403).send({
    message: errorHandler.getErrorMessageByKey('forbidden')
  });
};

/**
 * List all tags
 */
exports.listTags = function(req, res) {

  Tag.find(
    {
      public: true,
      tribe: false
    },
    exports.tagFields,
    {
      sort: {
        count: 'desc'
      }
    }
  )
  .exec(function(err, tribes) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(tribes);
    }
  });
};

/**
 * Return tag
 */
exports.getTag = function(req, res) {
  res.json(req.tag || {});
};

/**
 * Tag middleware
 */
exports.tagBySlug = function(req, res, next, slug) {

  Tag.findOne(
    {
      public: true,
      tribe: false,
      slug: slug
    },
    exports.tagFields
  )
  .exec(function(err, tag) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      req.tag = tag;
    }
  });

  return next();
};
