/**
 * Module dependencies.
 */
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const mongoose = require('mongoose');
const User = mongoose.model('User');
const log = require(path.resolve('./config/lib/logger'));

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

  log('info', `${req.user._id} blocking ${idToBeBlocked}`);
  try {
    // get logged user and update
    loggedUser = await User.updateOne(
      { _id: req.user._id },
      {
        $addToSet: {
          blocked: { userId: idToBeBlocked },
        },
      },
    );

    // No documents were updated
    if (!loggedUser.n) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    res.send({ message: `${req.profile.username} added to block list. ` });
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
  log('info', `${req.user._id} unblocking ${idToBeUnBlocked}`);
  try {
    // get logged user and update
    const result = await User.updateOne(
      { _id: req.user._id },
      {
        $pullAll: {
          blocked: [{ userId: idToBeUnBlocked }],
        },
      },
    );

    // No documents were updated
    if (!result.n || !result.nModified) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    res.send({ message: `${req.profile.username} removed from block list.` });
  } catch (err) {
    return res.status(500).send({
      message: 'invalid error',
    });
  }
};
