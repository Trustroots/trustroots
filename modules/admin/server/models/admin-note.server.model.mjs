import mongoose from 'mongoose';
import textService from './../../../core/server/services/text.server.service.mjs';

// External dependencies

// Internal dependencies

const { Schema } = mongoose;
const AdminNoteSchema = new Schema({
  admin: {
    type: Schema.ObjectId,
    ref: 'User',
  },
  note: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User',
  },
});

// Sanitize and linkify note before output
AdminNoteSchema.post('find', results =>
  results.map(result => {
    result.note = textService.html(result.note);
    return result;
  }),
);
mongoose.model('AdminNote', AdminNoteSchema);
const defaultInterop = {};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
