'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
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
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // @todo
  return res.status(403).send({
    message: errorService.getErrorMessageByKey('forbidden')
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
        message: errorService.getErrorMessage(err)
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
        message: errorService.getErrorMessage(err)
      });
    } else {
      req.tag = tag;
    }
  });

  return next();
};

/**
 * @param {string} tagId - the id of the tribe/tag
 * @param {number} difference - how much to add or remove (negative) from the tag.count?
 * @param {function} callback
 */
exports.editCount = function (tagId, difference, callback) {
  Tag.findByIdAndUpdate(tagId, { $inc: { count: difference } }, callback);
};
