// External dependencies
const mongoose = require('mongoose');

// Internal dependencies
const textService = require('../../../core/server/services/text.server.service');

const { Schema } = mongoose;

const AdminNoteSchema = new Schema({
  admin: {
    type: Schema.ObjectId,
    ref: 'User',
  },
  note: { type: String },
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
