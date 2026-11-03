import mongoose, { type Types } from 'mongoose';
import { deleteUserAccount } from '../../../users/server/controllers/users.profile.server.controller.mts';
import type {
  UserServerModel,
  UserServerRecord,
} from '../../../users/server/models/user.server.types.mts';

interface Request {
  body?: {
    id?: unknown;
    username?: unknown;
    reason?: unknown;
    keywords?: unknown;
  };
  user?: { _id: Types.ObjectId | string; roles: string[] };
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}

export async function deleteMember(req: Request, res: Response) {
  if (!req.user?.roles.includes('admin'))
    return res.status(403).send({ message: 'Administrator access required.' });
  const { id, username, reason, keywords = [] } = req.body || {};
  if (
    typeof id !== 'string' ||
    !/^[a-f\d]{24}$/i.test(id) ||
    typeof username !== 'string' ||
    !username ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.trim().length > 1000 ||
    !Array.isArray(keywords) ||
    keywords.length > 20 ||
    keywords.some(
      keyword =>
        typeof keyword !== 'string' ||
        !keyword.trim() ||
        keyword.trim().length > 80,
    )
  )
    return res.status(400).send({
      message:
        'Enter the exact username and a reason of at most 1,000 characters.',
    });
  if (id.toLowerCase() === String(req.user._id))
    return res.status(403).send({
      message: 'You cannot delete your own account from administration.',
    });
  try {
    const User = mongoose.model<UserServerRecord, UserServerModel>('User');
    const member = await User.findById(id);
    if (!member) return res.status(404).send({ message: 'Member not found.' });
    if (member.roles.includes('admin') || !member.roles.includes('suspended'))
      return res.status(409).send({
        message:
          'Only suspended members without administrator access can be deleted.',
      });
    if (member.username !== username)
      return res
        .status(400)
        .send({ message: 'The username confirmation does not match.' });
    await new (mongoose.model('AuditLog'))({
      user: req.user._id,
      route: '/api/admin/user/delete',
      body: {
        id: String(member._id),
        username,
        reason: reason.trim(),
        keywords: [...new Set(keywords.map(keyword => keyword.trim()))],
      },
      params: {},
      query: {},
    }).save();
    await deleteUserAccount(member, true);
    return res.send({ message: 'Member account deleted.' });
  } catch {
    return res.status(500).send({
      message:
        'Deletion could not be completed. Refresh the member report before trying again.',
    });
  }
}
