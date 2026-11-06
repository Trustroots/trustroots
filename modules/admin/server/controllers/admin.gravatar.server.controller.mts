import mongoose, { type Types } from 'mongoose';

interface GravatarMember {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
}
interface GravatarResult {
  total: { accounts: number }[];
  members: GravatarMember[];
}
interface Response {
  status(code: number): Response;
  send(body: unknown): unknown;
}
const User = mongoose.model('User');
const PAGE_SIZE = 50;

export async function list(
  req: { query?: { page?: unknown } },
  res: Response,
): Promise<unknown> {
  const rawPage = req.query?.page ?? '1';
  const page =
    typeof rawPage === 'number'
      ? rawPage
      : typeof rawPage === 'string' && /^\d+$/.test(rawPage)
        ? Number(rawPage)
        : NaN;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE)
  ) {
    return res.status(400).send({ message: 'Invalid page.' });
  }
  try {
    const [result] = await User.aggregate<GravatarResult>([
      { $match: { avatarSource: 'gravatar' } },
      {
        $facet: {
          total: [{ $count: 'accounts' }],
          members: [
            { $sort: { _id: 1 } },
            { $skip: (page - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            { $project: { _id: 1, username: 1, displayName: 1 } },
          ],
        },
      },
    ]).exec();
    const accounts = result.total[0]?.accounts ?? 0;
    return res.send({
      accounts,
      members: result.members,
      page,
      hasNextPage: page * PAGE_SIZE < accounts,
      measuredAt: new Date().toISOString(),
    });
  } catch {
    return res.status(500).send({ message: 'Could not load Gravatar usage.' });
  }
}

const service = { list };
export default service;
export { service as 'module.exports' };
