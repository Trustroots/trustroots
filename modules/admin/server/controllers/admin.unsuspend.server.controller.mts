import mongoose, { type Types } from 'mongoose';

interface Member {
  _id: Types.ObjectId;
  username: string;
  roles: string[];
  authVersion?: number;
}
interface Audit {
  user: Types.ObjectId | string;
  route: string;
  date?: Date;
  body: {
    id: string;
    username: string;
    reason: string;
    outcome: 'requested' | 'unsuspended' | 'conflict';
  };
  params: Record<string, never>;
  query: Record<string, never>;
}
interface Request {
  user?: { _id: Types.ObjectId | string; roles: string[] };
  body?: { id?: unknown; reason?: unknown; confirmed?: unknown };
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}
const User = mongoose.model<Member>('User');
const AuditLog = mongoose.model<Audit>('AuditLog');

export async function unsuspendMember(
  req: Request,
  res: Response,
): Promise<unknown> {
  if (!req.user?.roles.includes('admin')) {
    return res.status(403).send({ message: 'Administrator access required.' });
  }
  const { id, reason, confirmed } = req.body || {};
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    return res.status(400).send({ message: 'A valid member ID is required.' });
  }
  if (
    confirmed !== true ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.trim().length > 1000
  ) {
    return res.status(400).send({
      message:
        'Confirm unsuspension and give a reason of at most 1,000 characters.',
    });
  }
  try {
    const member = await User.findById(new mongoose.Types.ObjectId(id))
      .select('username roles authVersion')
      .lean()
      .exec();
    if (!member) return res.status(404).send({ message: 'Member not found.' });
    if (!member.roles.includes('suspended')) {
      return res.send({
        changed: false,
        message: 'Member is already unsuspended.',
      });
    }
    // Persist intent first: an audit storage failure must not restore access.
    const audit = new AuditLog({
      user: req.user._id,
      route: '/api/admin/user/unsuspend',
      body: {
        id: String(member._id),
        username: member.username,
        reason: reason.trim(),
        outcome: 'requested',
      },
      params: {},
      query: {},
    });
    await audit.save();
    const result = await User.updateOne(
      {
        _id: member._id,
        roles: member.roles,
        authVersion:
          member.authVersion === undefined
            ? { $exists: false }
            : member.authVersion,
      },
      { $pull: { roles: 'suspended' }, $inc: { authVersion: 1 } },
    );
    audit.body = {
      ...audit.body,
      outcome: result.matchedCount ? 'unsuspended' : 'conflict',
    };
    await audit.save();
    if (!result.matchedCount) {
      return res.status(409).send({
        message:
          'The member state changed. Refresh the report and review the suspension again.',
      });
    }
    return res.send({ changed: true, message: 'Member unsuspended.' });
  } catch {
    return res.status(500).send({
      message:
        'Unsuspension could not be confirmed. Refresh the member report before trying again.',
    });
  }
}

const service = { unsuspendMember };
export default service;
export { service as 'module.exports' };
