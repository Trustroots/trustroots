import mongoose from 'mongoose';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function encodeCursor(event) {
  return Buffer.from(
    JSON.stringify({
      createdAt: event.createdAt.toISOString(),
      id: String(event._id),
    }),
  ).toString('base64url');
}

function decodeCursor(value) {
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString());
    const createdAt = new Date(decoded.createdAt);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      typeof decoded.id !== 'string' ||
      !decoded.id ||
      decoded.id.length > 128
    ) {
      return null;
    }
    return { createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

export async function list(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  if (!req.user) return res.sendStatus(403);

  const limitValue = req.query.limit;
  const limit =
    limitValue === undefined ? DEFAULT_PAGE_SIZE : Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    return res.status(400).json({ message: 'Invalid activity page size.' });
  }
  const cursorValue = req.query.cursor;
  const cursor =
    cursorValue === undefined
      ? null
      : typeof cursorValue === 'string' && cursorValue.length <= 512
        ? decodeCursor(cursorValue)
        : null;
  if (cursorValue !== undefined && !cursor) {
    return res.status(400).json({ message: 'Invalid activity cursor.' });
  }

  try {
    const filter = {
      user: req.user._id,
      createdAt: { $gte: new Date(Date.now() - RETENTION_MS) },
    };
    if (cursor) {
      filter.$and = [
        {
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }
    const events = await mongoose
      .model('AccountActivity')
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .select('_id eventType createdAt')
      .lean()
      .exec();
    const hasMore = events.length > limit;
    const page = events.slice(0, limit);
    return res.json({
      events: page.map(({ eventType, createdAt }) => ({
        eventType,
        createdAt,
      })),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    });
  } catch (error) {
    return next(error);
  }
}

const service = { list };
export default service;
export { service as 'module.exports' };
