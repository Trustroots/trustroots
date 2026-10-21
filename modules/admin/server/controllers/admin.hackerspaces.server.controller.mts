import mongoose from 'mongoose';
import { nip19 } from 'nostr-tools';
import { fetchSpaceApiCollector } from '../services/hackerspaces.server.service.mts';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
}

function getErrorMessage(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }
  return error.message;
}

export async function preview(_req: unknown, res: JsonResponse): Promise<void> {
  try {
    res.json(await fetchSpaceApiCollector());
  } catch (error) {
    res.status(502).json({
      message:
        getErrorMessage(error) || 'Could not fetch the SpaceAPI Collector.',
    });
  }
}
export async function signerIdentity(
  req: { query: Record<string, unknown> },
  res: JsonResponse,
): Promise<unknown> {
  const publicKey = req.query.publicKey;
  if (typeof publicKey !== 'string' || !/^[0-9a-f]{64}$/i.test(publicKey)) {
    return res
      .status(400)
      .json({ message: 'A valid Nostr public key is required.' });
  }
  try {
    const user = await mongoose
      .model<{ username: string }>('User')
      .findOne({
        nostrNpub: nip19.npubEncode(publicKey.toLowerCase()),
        public: true,
        email: { $exists: true, $nin: ['', null] },
        roles: { $nin: ['suspended', 'shadowban'] },
      })
      .select('username -_id')
      .lean()
      .exec();
    return res.json({ nip05: user ? `${user.username}@trustroots.org` : null });
  } catch {
    return res
      .status(500)
      .json({ message: 'Could not look up the signing identity.' });
  }
}

const defaultInterop = { preview, signerIdentity };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
