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
 * Get the list of blocked users by the logged in user
 */
exports.getBlockedUsers = function (req, res) {
  res.json(req.user.blocked || []);
};

/**
 * Add a new userId to the blocked list
 */
exports.blockUser = async function (req, res) {
  /*
   * req.profile was instantiated by a prev middleware
   */
  if (!req.profile || req.profile._id === req.user._id) {
    return res.status(500).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const idToBeBlocked = req.profile._id;
  let loggedUser;
  try {
    // get logged user and update
    loggedUser = await User.updateOne(
      { username: req.user._id },
      {
        $addToSet: {
          blocked: idToBeBlocked,
        },
      },
    );

    // No documents were updated
    if (!loggedUser.n) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    res.send({ message: '{usernameToBeBlocked} added to block list.' });
  } catch (err) {
    return res.status(500).send({
      message: 'invalid error',
    });
  }
};

/**
 * Remove a user from the blocked list
 */
exports.unblockUser = async function (req, res) {
  /*
   * req.profile was instantiated by a prev middleware
   */
  if (!req.profile) {
    return res.status(500).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const idToBeUnBlocked = req.profile._id;
  let loggedUser;
  try {
    // get logged user and update
    loggedUser = await User.updateOne(
      { username: req.user._id },
      {
        $pullAll: {
          blocked: idToBeUnBlocked,
        },
      },
    );

    // No documents were updated
    if (!loggedUser.n) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    res.send({ message: '{usernameToBeBlocked} added to block list.' });
  } catch (err) {
    return res.status(500).send({
      message: 'invalid error',
    });
  }
};
