import crypto from 'node:crypto';
import mongoose from 'mongoose';
import log from '@trustroots/logger';
import type { AccountActivityEventType } from '../../shared/account-activity.ts';

interface ActivityInput {
  userId: mongoose.Types.ObjectId;
  eventType: AccountActivityEventType;
  eventId?: string;
}

// One immediate retry only. Do not sleep on the request path; session creation
// keeps a stable event id so a later request can retry if both attempts fail.
const MAX_ATTEMPTS = 2;

function classifyError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  if (Number.isInteger(code)) return `database-${code}`;
  return 'storage-error';
}

export async function recordActivity({
  userId,
  eventType,
  eventId = crypto.randomUUID(),
}: ActivityInput) {
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
