import type { RequestLimitRecord } from '../models/request-limit.server.model.mts';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../../../../config/config.mts';
interface RequestLimitDimension {
  name: string;
  value: unknown;
  limit: number;
}
interface ConsumeOptions {
  operation: string;
  dimensions: RequestLimitDimension[];
  windowMs: number;
  now?: number;
}
interface ConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const RequestLimit = mongoose.model<RequestLimitRecord>('RequestLimit');

function digest(value: unknown): string {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(String(value))
    .digest('hex');
}

function makeKey(
  operation: string,
  dimension: string,
  value: unknown,
  windowStart: number,
): string {
  return digest(JSON.stringify([operation, dimension, value, windowStart]));
}

async function increment(key: string, expiresAt: Date) {
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt },
  };

  try {
    return await RequestLimit.findOneAndUpdate({ key }, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: false,
    });
  } catch (error) {
    // Concurrent first requests can both attempt the unique-key upsert. The
    // loser retries as an update after the winner has created the document.
    if ((error as { code?: number }).code !== 11000) throw error;
    return RequestLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      {
        new: true,
      },
    );
  }
}

async function consume({
  operation,
  dimensions,
  windowMs,
  now = Date.now(),
}: ConsumeOptions): Promise<ConsumeResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const expiresAt = new Date(windowStart + windowMs);
  const results = [];

  for (const dimension of dimensions) {
    const key = makeKey(
      operation,
      dimension.name,
      dimension.value,
      windowStart,
    );
    const document = await increment(key, expiresAt);
    results.push({ count: document!.count, limit: dimension.limit });
  }

  return {
    allowed: results.every(result => result.count <= result.limit),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now) / 1000),
    ),
  };
}

const defaultExport = { consume, digest };
export default defaultExport;
export { consume, digest };
export { defaultExport as 'module.exports' };
