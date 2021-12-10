/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const mongoose = require('mongoose');
const Message = mongoose.model('Message');
const MessagesController = require(path.resolve(
  'modules/messages/server/controllers/messages.server.controller.js',
));

/*
 * This middleware sends response with an array of found users
 */
exports.getMessages = (req, res) => {
  const user1 = _.get(req, ['body', 'user1']);
  const user2 = _.get(req, ['body', 'user2']);

  // Check that all provided IDs are  valid
  if (
    ![user1, user2].every(
      user => !user || mongoose.Types.ObjectId.isValid(user),
    )
  ) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  Message.find({
    $or: [
      { userFrom: user1, userTo: user2 },
      { userFrom: user2, userTo: user1 },
    ],
  })
    .sort({ created: 1 })
    .populate({
      path: 'userFrom',
      select: 'username displayName',
      model: 'User',
    })
    .populate({
      path: 'userTo',
      select: 'username displayName',
      model: 'User',
    })
    .exec((err, messages) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      return res.send(MessagesController.sanitizeMessages(messages));
    });
};
