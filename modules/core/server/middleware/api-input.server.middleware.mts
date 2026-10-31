import type { NextFunction } from 'express';
const reservedKeys = new Set(['__proto__', 'constructor', 'prototype']);

/** Keep request objects as data rather than database query expressions. */
export default function validateApiInput(
  req: { body?: unknown; query?: unknown },
  res: { status(code: number): { send(body: { message: string }): unknown } },
  next: NextFunction,
) {
  const pending = [req.body, req.query];
  while (pending.length) {
    const value = pending.pop();
    if (value === null || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || reservedKeys.has(key)) {
        return res.status(400).send({ message: 'Invalid request field.' });
      }
      pending.push(child);
    }
  }
  return next();
}
/** @commonjs */
export { validateApiInput as 'module.exports' };
