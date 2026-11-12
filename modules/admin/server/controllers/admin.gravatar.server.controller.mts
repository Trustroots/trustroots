import mongoose, { type Types } from 'mongoose';
import { gravatarSortColumns } from '../../shared/gravatar.mts';

interface GravatarMember {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
  seen?: Date;
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
  req: { query?: { page?: unknown; sort?: unknown; direction?: unknown } },
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
  const rawSort = req.query?.sort;
  const column = gravatarSortColumns.find(column => column === rawSort);
  const direction = req.query?.direction ?? 'ascending';
  if (
    (rawSort !== undefined && !column) ||
    (direction !== 'ascending' && direction !== 'descending')
  ) {
    return res.status(400).send({ message: 'Invalid sort.' });
  }
  const sort: Record<string, 1 | -1> = {};
  if (column === 'seen') sort.seenMissing = 1;
  if (column) sort[column] = direction === 'ascending' ? 1 : -1;
  sort._id = 1;

  try {
    const [result] = await User.aggregate<GravatarResult>(
      [
        { $match: { avatarSource: 'gravatar' } },
        { $project: { _id: 1, username: 1, displayName: 1, seen: 1 } },
        {
          $facet: {
            total: [{ $count: 'accounts' }],
            members: [
              ...(column === 'seen'
                ? [
                    {
                      $set: {
                        seenMissing: { $ne: [{ $type: '$seen' }, 'date'] },
                      },
                    },
                  ]
                : []),
              { $sort: sort },
              { $skip: (page - 1) * PAGE_SIZE },
              { $limit: PAGE_SIZE },
              { $unset: 'seenMissing' },
            ],
          },
        },
      ],
      column === 'username' || column === 'displayName'
        ? { collation: { locale: 'en', strength: 2 } }
        : undefined,
    ).exec();
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
