import mongoose, { type Types } from 'mongoose';
import {
  getReviewRules,
  normaliseReviewRules,
  RULES_ID,
} from '../../../users/server/services/signup-review-rules.server.service.mts';
import type { SignupReviewRules } from '../../../users/server/models/signup-review-rules.server.model.mts';

interface Request {
  user?: { _id: Types.ObjectId | string; roles: string[] };
  body?: { revision?: unknown; rules?: unknown };
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}

export async function list(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  try {
    const { revision, rules } = await getReviewRules();
    return res.send({ revision, rules });
  } catch {
    return res
      .status(500)
      .send({ message: 'Could not load signup review rules.' });
  }
}

export async function save(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  const { revision, rules: input } = req.body || {};
  const rules = normaliseReviewRules(input);
  if (!Number.isSafeInteger(revision) || Number(revision) < 0 || !rules)
    return res.status(400).send({
      message:
        'Provide a current revision and at most 500 unique, valid keyword, email or domain rules.',
    });
  try {
    const current = await getReviewRules();
    if (current.revision !== revision)
      return res
        .status(409)
        .send({ message: 'Rules changed. Reload before saving again.' });
    await new (mongoose.model('AuditLog'))({
      user: req.user._id,
      route: '/api/admin/signup-review-rules',
      body: { revision, rules },
      params: {},
      query: {},
    }).save();
    const saved = await mongoose
      .model<SignupReviewRules>('SignupReviewRules')
      .findOneAndUpdate(
        { _id: RULES_ID, revision: Number(revision) },
        { $set: { rules }, $inc: { revision: 1 } },
        { upsert: revision === 0, returnDocument: 'after' },
      );
    if (!saved)
      return res
        .status(409)
        .send({ message: 'Rules changed. Reload before saving again.' });
    return res.send({ revision: saved.revision, rules: saved.rules });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      return res
        .status(409)
        .send({ message: 'Rules changed. Reload before saving again.' });
    return res
      .status(500)
      .send({ message: 'Could not save signup review rules.' });
  }
}
