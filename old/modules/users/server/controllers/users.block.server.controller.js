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
exports.getBlockedUsers = async function (req, res) {
  try {
    const user = await User.findById(req.user._id)
      // Avoid pulling in sensitive fields from Mongoose
      .select('-password -salt')
      .populate({
        path: 'blocked',
        select: 'username displayName',
        model: 'User',
      });
    res.send(user.blocked);
  } catch (err) {
    log('error', err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
    });
  }
};

/**
 * Add a new userId to the blocked list
 */
exports.blockUser = async function (req, res) {
  /*
   * req.profile was instantiated by a prev middleware
   */
  if (!req.profile || req.profile._id.equals(req.user._id)) {
    return res.status(400).send({
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

    res.send(`${req.profile.username} added to block list.`);
  } catch (err) {
    log('error', err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
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
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }
  const idToBeUnBlocked = req.profile._id;
  log(
    'info',
    `${req.user._id} unblocking ${req.params.username}:${idToBeUnBlocked}`,
  );
  try {
    // get logged user and update
    const result = await User.updateOne(
      { _id: req.user._id },
      {
        $pullAll: {
          blocked: [idToBeUnBlocked],
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
    log('error', err);
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('default'),
    });
  }
};
