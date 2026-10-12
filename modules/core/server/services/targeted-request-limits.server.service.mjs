import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../../../../config/config.mjs';

const RequestLimit = mongoose.model('RequestLimit');

function digest(value) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(String(value))
    .digest('hex');
}

function makeKey(operation, dimension, value, windowStart) {
  return digest(JSON.stringify([operation, dimension, value, windowStart]));
}

async function increment(key, expiresAt) {
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
    if (error.code !== 11000) throw error;
    return RequestLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 } },
      {
        new: true,
      },
    );
  }
}

async function consume({ operation, dimensions, windowMs, now = Date.now() }) {
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
    results.push({ count: document.count, limit: dimension.limit });
  }

  return {
    allowed: results.every(result => result.count <= result.limit),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now) / 1000),
    ),
  };
}

const defaultExport = { consume, digest, makeKey };
export default defaultExport;
export { consume, digest, makeKey };
export { defaultExport as 'module.exports' };
