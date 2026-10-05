/**
 * Module dependencies.
 */
import _ from 'lodash';
import errorService from '../../../core/server/services/error.server.service.js';
import textService from '../../../core/server/services/text.server.service.js';
import sanitizeHtml from 'sanitize-html';
import mongoose from 'mongoose';
const AdminNote = mongoose.model('AdminNote');

/**
 * Add notes to any user
 */
export const addNote = async (req, res) => {
  const userId = _.get(req, ['body', 'userId']);
  const note = _.get(req, ['body', 'note']);

  if (typeof note !== 'string' || note.trim() === '') {
    return res.status(400).send({
      message: 'Empty note.',
    });
  }

  // Check that the user id is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId))
    return errorService.sendInvalidId(res);

  try {
    const adminNoteItem = new AdminNote({
      admin: req.user._id,
      note: sanitizeHtml(note, textService.sanitizeOptions),
      user: userId,
    });

    await adminNoteItem.save();
    res.send({ message: 'Note saved.' });
  } catch (err) {
    /* istanbul ignore else */
    if (err) {
      return errorService.sendBadRequest(res, err);
    }
  }
};

/**
 * Read notes of a user
 */
export const getNotes = async (req, res) => {
  const userId = _.get(req, ['query', 'userId']);

  // Check that the user id is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId))
    return errorService.sendInvalidId(res);

  AdminNote.find({ user: userId })
    .sort('-date')
    .populate({
      path: 'admin',
      select: 'username displayname',
      model: 'User',
    })
    .exec((err, items) => {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
      res.send(items || []);
    });
};

export default { addNote, getNotes };
