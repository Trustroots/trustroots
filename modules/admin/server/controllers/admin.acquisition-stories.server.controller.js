/**
 * Module dependencies.
 */
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const mongoose = require('mongoose');

const User = mongoose.model('User');

/**
 * This middleware stores queries to audit log
 */
exports.list = (req, res) => {
  User.find(
    {
      acquisitionStory: { $exists: true, $ne: '' },
    },
    '_id acquisitionStory created',
  )
    .sort('-created')
    .limit(1000)
    .exec((err, items) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
      res.send(items || []);
    });
};
