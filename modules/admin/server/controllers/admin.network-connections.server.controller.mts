import mongoose, { type Types } from 'mongoose';
import {
  NETWORKS,
  currentConnections,
  connectionSearchKey,
  parseConnectionSearch,
  type ConnectionHistoryEntry,
} from '../../../users/shared/network-connections.ts';
import type { UserServerRecord } from '../../../users/server/models/user.server.types.mts';

interface StaffRequest {
  query: { page?: unknown; network?: unknown; identifier?: unknown };
  params: { memberId?: string };
  route: { path: string };
  user: { _id: Types.ObjectId | string };
}

interface StaffResponse {
  status(code: number): StaffResponse;
  send(body: unknown): unknown;
}

const User = mongoose.model<UserServerRecord>('User');
const AuditLog = mongoose.model('AuditLog');
const PAGE_SIZE = 50;
const CONNECTION_FIELDS =
  'email extSitesCouchers extSitesBW extSitesCS extSitesWS extSitesServas nostrNpub additionalProvidersData.facebook.id additionalProvidersData.twitter.screen_name additionalProvidersData.github.login';

function pageNumber(value: unknown): number | null {
  if (value === undefined) return 1;
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^[1-9]\d{0,5}$/.test(String(value))
  ) {
    return null;
  }
  return Number(value);
}

async function audit(req: StaffRequest, page: number): Promise<void> {
  // Record access, not external identifiers: those are deleted with the member.
  // Fail closed if the staff access log cannot be persisted.
  await new AuditLog({
    user: req.user._id,
    route: req.route.path,
    params: req.params,
    query: {
      page,
      ...(req.query.network ? { network: req.query.network } : {}),
    },
    body: {},
  }).save();
}

export async function history(req: StaffRequest, res: StaffResponse) {
  const page = pageNumber(req.query.page);
  const id = req.params.memberId;
  if (page === null || !id || !/^[a-f\d]{24}$/i.test(id)) {
    return res
      .status(400)
      .send({ message: 'Invalid connection history request.' });
  }
  try {
    const projection: Record<string, unknown> = Object.fromEntries(
      CONNECTION_FIELDS.split(' ').map(field => [field, 1]),
    );
    projection.history = {
      $slice: [
        { $reverseArray: { $ifNull: ['$connectionHistory', []] } },
        (page - 1) * PAGE_SIZE,
        PAGE_SIZE + 1,
      ],
    };
    const [member] = await User.aggregate<
      UserServerRecord & { history: ConnectionHistoryEntry[] }
    >([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $project: projection },
    ]).exec();
    if (!member) {
      return res.status(404).send({ message: 'Member not found.' });
    }
    await audit(req, page);
    return res.send({
      current: currentConnections(member),
      history: member.history.slice(0, PAGE_SIZE),
      page,
      hasNextPage: member.history.length > PAGE_SIZE,
    });
  } catch {
    return res
      .status(500)
      .send({ message: 'Could not load connection history.' });
  }
}

export async function search(req: StaffRequest, res: StaffResponse) {
  const page = pageNumber(req.query.page);
  const network = NETWORKS.find(item => item.id === req.query.network)?.id;
  const input = req.query.identifier;
  if (
    page === null ||
    !network ||
    typeof input !== 'string' ||
    input.length > 2048
  ) {
    return res.status(400).send({ message: 'Invalid connection search.' });
  }
  const identifier = parseConnectionSearch(network, input);
  if (!identifier) {
    return res.status(400).send({
      message: 'Enter a valid identifier or profile URL for this network.',
    });
  }
  try {
    const key = connectionSearchKey(network, identifier);
    const members = await User.find(
      network === 'email'
        ? { $or: [{ connectionSearchKeys: key }, { email: identifier }] }
        : { connectionSearchKeys: key },
    )
      .select(`username displayName ${CONNECTION_FIELDS}`)
      .sort({ _id: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .lean();
    await audit(req, page);
    return res.send({
      members: members.slice(0, PAGE_SIZE).map(member => ({
        _id: member._id,
        username: member.username,
        displayName: member.displayName,
        identifier,
        current: currentConnections(member).some(
          connection =>
            connection.network === network &&
            connectionSearchKey(network, connection.identifier) === key,
        ),
      })),
      page,
      hasNextPage: members.length > PAGE_SIZE,
    });
  } catch {
    return res.status(500).send({ message: 'Could not search connections.' });
  }
}

const api = { history, search };
export default api;
export { api as 'module.exports' };
