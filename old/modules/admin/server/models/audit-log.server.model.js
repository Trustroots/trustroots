// External dependencies
const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Audit log Schema
 *
 * Administrator audit logging collection
 */
const AuditLogSchema = new Schema({
  body: { type: Object },
  date: {
    type: Date,
    default: Date.now,
  },
  ip: { type: String },
  params: { type: Object },
  query: { type: Object },
  route: { type: String },
  user: {
    type: Schema.ObjectId,
    ref: 'User',
  },
});

mongoose.model('AuditLog', AuditLogSchema);
