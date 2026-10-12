import crypto from 'node:crypto';
import mongoose from 'mongoose';
import log from '../../../../config/lib/logger.mjs';

const RETRY_DELAYS = [20, 60];

function classifyError(error) {
  if (Number.isInteger(error?.code)) return `database-${error.code}`;
  return 'storage-error';
}

export async function recordActivity({
  userId,
  eventType,
  eventId = crypto.randomUUID(),
}) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
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
      if (attempt < RETRY_DELAYS.length) {
        await new Promise(resolve =>
          setTimeout(resolve, RETRY_DELAYS[attempt]),
        );
      } else {
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
