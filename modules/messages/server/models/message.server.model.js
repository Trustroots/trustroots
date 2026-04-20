/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const Schema = mongoose.Schema;

/**
 * Message Schema
 */
const MessageSchema = new Schema({
  created: {
    type: Date,
    default: Date.now,
  },
  content: {
    type: String,
    default: '',
    trim: true,
    required: 'Message cannot be blank',
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  spam: {
    type: Boolean,
    // No default; lack of value means no definitive check has been done
  },
  // Hidden delivery path used for shadowbanned/suspended senders:
  // sender can still see own messages, recipients can't.
  shadowHidden: {
    type: Boolean,
    default: false,
    index: true,
  },
  /* Count and the latest date of notifications sent to `userTo`
     about unread messages (`read:false`) */
  notificationCount: {
    type: Number,
    default: 0,
    required: true,
  },
});

MessageSchema.index({ read: 1, created: 1, notificationSent: 1 });

MessageSchema.plugin(mongoosePaginate);

mongoose.model('Message', MessageSchema);
