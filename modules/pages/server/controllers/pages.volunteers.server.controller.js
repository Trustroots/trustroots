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
  const VOLUNTEER_LIST_FIELDS = ['username', 'displayName'].join(' ');

  User.find({
    roles: { $in: ['volunteer'] },
  })
    .select(VOLUNTEER_LIST_FIELDS)
    .sort('username displayName volunteerStory')
    .limit(1000)
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      res.send(_.shuffle(users || []));
    });
};
