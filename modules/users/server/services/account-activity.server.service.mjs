import crypto from 'node:crypto';
import mongoose from 'mongoose';
import log from '../../../../config/lib/logger.mjs';

// One immediate retry only. Do not sleep on the request path; session creation
// keeps a stable event id so a later request can retry if both attempts fail.
const MAX_ATTEMPTS = 2;

function classifyError(error) {
  if (Number.isInteger(error?.code)) return `database-${error.code}`;
  return 'storage-error';
}

export async function recordActivity({
  userId,
  eventType,
  eventId = crypto.randomUUID(),
}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.model('AccountActivity').updateOne(
        { _id: eventId },
        {
          $setOnInsert: {
            user: userId,
            eventType,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      return true;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        log('error', 'Account activity recording failed.', {
          eventType,
          errorCategory: classifyError(error),
        });
      }
    }
  }
  return false;
}

const service = { recordActivity };
export default service;
export { service as 'module.exports' };
