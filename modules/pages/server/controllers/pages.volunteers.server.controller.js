/**
 * Module dependencies.
 */
const path = require('path');
const _ = require('lodash');
const mongoose = require('mongoose');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

const User = mongoose.model('User');

/*
 * This middleware sends response with an array of users with volunteer role
 */
exports.list = (req, res) => {
  User.find({
    roles: { $in: ['volunteer'] },
  })
    .select('username firstName')
    .sort('firstName username')
    .limit(500)
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      res.send(_.shuffle(users || []));
    });
};
