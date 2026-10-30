/**
 * Module dependencies.
 */
import _ from 'lodash';
import errorService from './../../../core/server/services/error.server.service.mjs';
import textService from './../../../core/server/services/text.server.service.mts';
import sanitizeHtml from 'sanitize-html';
import mongoose, { type Types } from 'mongoose';

interface AdminNoteRecord {
  admin: Types.ObjectId | string;
  user: Types.ObjectId | string;
  note: string;
  date?: Date;
}

interface NoteRequest {
  body?: unknown;
  query?: unknown;
  user?: { _id: Types.ObjectId | string };
}

interface NoteResponse {
  status(code: number): NoteResponse;
  send(body: unknown): unknown;
}

type ObjectIdInput =
  | string
  | Types.ObjectId
  | { id: string | Buffer; toHexString(): string }
  | Buffer
  | Uint8Array;

function isObjectIdLike(value: object): value is {
  id: string | Buffer;
  toHexString(): string;
} {
  return (
    'id' in value &&
    (typeof value.id === 'string' || Buffer.isBuffer(value.id)) &&
    'toHexString' in value &&
    typeof value.toHexString === 'function'
  );
}

function isValidObjectId(value: unknown): value is ObjectIdInput {
  if (
    typeof value === 'string' ||
    value instanceof mongoose.Types.ObjectId ||
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array
  ) {
    return Boolean(value) && mongoose.Types.ObjectId.isValid(value);
  }
  if (typeof value === 'object' && value !== null && isObjectIdLike(value)) {
    return mongoose.Types.ObjectId.isValid(value);
  }
  return false;
}

const AdminNote = mongoose.model<AdminNoteRecord>('AdminNote');

/**
 * Add notes to any user
 */
export const addNote = async (
  req: NoteRequest,
  res: NoteResponse,
): Promise<unknown> => {
  const userId: unknown = _.get(req, ['body', 'userId']);
  const note: unknown = _.get(req, ['body', 'note']);
  if (typeof note !== 'string' || note.trim() === '') {
    return res.status(400).send({
      message: 'Empty note.',
    });
  }

  // Check that the user id is provided
  if (!isValidObjectId(userId)) return errorService.sendInvalidId(res);

  try {
    const adminNoteItem = new AdminNote({
      admin: req.user!._id,
      note: sanitizeHtml(note, textService.sanitizeOptions),
      user: userId,
    });
    await adminNoteItem.save();
    res.send({
      message: 'Note saved.',
    });
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
export const getNotes = async (
  req: NoteRequest,
  res: NoteResponse,
): Promise<unknown> => {
  const userId: unknown = _.get(req, ['query', 'userId']);

  // Check that the user id is provided
  if (!isValidObjectId(userId)) return errorService.sendInvalidId(res);

  try {
    const items = await AdminNote.find({
      user: new mongoose.Types.ObjectId(userId),
    })
      .sort('-date')
      .populate({
        path: 'admin',
        select: 'username displayname',
        model: 'User',
      })
      .exec();
    res.send(items || []);
  } catch (err) {
    return errorService.sendBadRequest(res, err);
  }
};
const defaultInterop = {
  addNote,
  getNotes,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
