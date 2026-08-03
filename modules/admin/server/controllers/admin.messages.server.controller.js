/**
 * Module dependencies.
 */
const _ = require('lodash');
const errorService = require('../../../core/server/services/error.server.service');
const mongoose = require('mongoose');
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');
const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');
const MessagesController = require('../../../messages/server/controllers/messages.server.controller.js');
const textService = require('../../../core/server/services/text.server.service');

async function findScammerRecipients(username, currentUserId) {
  if (typeof username !== 'string' || !username.trim()) {
    const error = new Error('Missing `username` field.');
    error.statusCode = 400;
    throw error;
  }

  const scammer = await User.findOne({ username: username.trim() }).exec();
  if (!scammer) {
    const error = new Error('Member does not exist.');
    error.statusCode = 404;
    throw error;
  }

  const recipientIds = await Message.distinct('userTo', {
    userFrom: scammer._id,
  }).exec();
  const recipients = await User.find({
    _id: {
      $in: recipientIds.filter(
        id => !currentUserId || String(id) !== String(currentUserId),
      ),
    },
  })
    .select('username displayName')
    .sort({ username: 1 })
    .exec();

  return { scammer, recipients };
}

exports.getScammerRecipients = async (req, res) => {
  try {
    const { scammer, recipients } = await findScammerRecipients(
      _.get(req, ['body', 'username']),
      req.user && req.user._id,
    );
    return res.send({
      scammer: { _id: scammer._id, username: scammer.username },
      recipients,
    });
  } catch (err) {
    return res.status(err.statusCode || 400).send({
      message: err.statusCode ? err.message : errorService.getErrorMessage(err),
    });
  }
};

exports.sendScammerWarning = async (req, res) => {
  const content = _.get(req, ['body', 'content']);
  const cleanContent = textService.html(content);
  if (!cleanContent || textService.isEmpty(cleanContent)) {
    return res.status(400).send({ message: 'Please write a message.' });
  }

  try {
    const { scammer, recipients } = await findScammerRecipients(
      _.get(req, ['body', 'username']),
      req.user && req.user._id,
    );
    const messages = recipients.map(recipient => ({
      content: cleanContent,
      userFrom: req.user._id,
      userTo: recipient._id,
      read: false,
      shadowHidden: false,
      notified: false,
    }));
    const savedMessages = messages.length
      ? await Message.insertMany(messages)
      : [];
    if (savedMessages.length) {
      await Thread.bulkWrite(
        savedMessages.map(message => ({
          updateOne: {
            filter: {
              $or: [
                { userTo: message.userTo, userFrom: message.userFrom },
                { userTo: message.userFrom, userFrom: message.userTo },
              ],
            },
            update: {
              updated: Date.now(),
              userFrom: message.userFrom,
              userTo: message.userTo,
              message: message._id,
              read: false,
            },
            upsert: true,
          },
        })),
      );
    }
    return res.send({
      scammer: { _id: scammer._id, username: scammer.username },
      sent: savedMessages.length,
    });
  } catch (err) {
    return res.status(err.statusCode || 400).send({
      message: err.statusCode ? err.message : errorService.getErrorMessage(err),
    });
  }
};

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

      ReferenceThread.find({
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
        .exec((referenceThreadErr, referenceThreads) => {
          if (referenceThreadErr) {
            return res.status(400).send({
              message: errorService.getErrorMessage(referenceThreadErr),
            });
          }

          return res.send({
            messages: MessagesController.sanitizeMessages(messages),
            referenceThreads: referenceThreads || [],
          });
        });
    });
};
