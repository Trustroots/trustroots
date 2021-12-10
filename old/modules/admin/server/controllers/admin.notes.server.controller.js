/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');
const AdminNote = mongoose.model('AdminNote');

/**
 * Add notes to any user
 */
exports.addNote = async (req, res) => {
  const userId = _.get(req, ['body', 'userId']);
  const note = _.get(req, ['body', 'note']);

  if (typeof note !== 'string' || note.trim() === '') {
    return res.status(400).send({
      message: 'Empty note.',
    });
  }

  // Check that the user id is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  try {
    const adminNoteItem = new AdminNote({
      admin: req.user._id,
      note: sanitizeHtml(note, textService.sanitizeOptions),
      user: userId,
    });

    await adminNoteItem.save();
    res.send({ message: 'Note saved.' });
  } catch (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
    }
  }
};

/**
 * Read notes of a user
 */
exports.getNotes = async (req, res) => {
  const userId = _.get(req, ['query', 'userId']);

  // Check that the user id is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  AdminNote.find({ user: userId })
    .sort('-date')
    .populate({
      path: 'admin',
      select: 'username displayname',
      model: 'User',
    })
    .exec((err, items) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
      res.send(items || []);
    });
};
