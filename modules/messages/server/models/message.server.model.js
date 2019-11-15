/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    mongoosePaginate = require('mongoose-paginate'),
    Schema = mongoose.Schema;

/**
 * Message Schema
 */
var MessageSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  content: {
    type: String,
    default: '',
    trim: true,
    required: 'Message cannot be blank'
  },
  userFrom: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  userTo: {
    type: Schema.ObjectId,
    ref: 'User',
    index: true
  },
  read: {
    type: Boolean,
    default: false
  },
  /* Count and the latest date of notifications sent to `userTo`
     about unread messages (`read:false`) */
  notificationCount: {
    type: Number,
    default: 0,
    required: true
  }
});

MessageSchema.index({ read: 1, created: 1, notificationSent: 1 });

MessageSchema.plugin(mongoosePaginate);

mongoose.model('Message', MessageSchema);
