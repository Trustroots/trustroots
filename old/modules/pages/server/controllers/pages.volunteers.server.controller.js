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

function filterAndCleanVolunteers(users, role) {
  return users
    .filter(user => user.roles.includes(role))
    .map(user => ({
      _id: user._id,
      firstName: user.firstName,
      username: user.username,
    }));
}

/*
 * This middleware sends response with an array of users with volunteer role
 */
exports.list = (req, res) => {
  User.find({
    roles: { $in: ['volunteer', 'volunteer-alumni'] },
  })
    .select('username firstName roles')
    .sort('firstName username')
    .limit(500)
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      // Put to two groups based on role
      const volunteers = filterAndCleanVolunteers(users, 'volunteer');
      const alumni = filterAndCleanVolunteers(users, 'volunteer-alumni');

      res.send({
        volunteers: _.shuffle(volunteers),
        alumni: _.shuffle(alumni),
      });
    });
};
