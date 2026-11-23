import { createHash, randomBytes } from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import { verifyEvent } from 'nostr-tools';
import { z } from 'zod';
import config from '../../../../config/config.mts';
import unifiedPush from '../../../users/server/services/unified-push.server.service.mts';

export const translationAlertsPath = '/api/mobile/v0/nostranslation/alerts';

const lifetime = 120;
const hexKey = z.string().regex(/^[0-9a-f]{64}$/);
const destination = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('android'),
    endpoint: z.string().max(2048),
    publicKey: z.string().max(88),
    auth: z.string().max(24),
  }),
  z.object({
    platform: z.literal('ios'),
    token: z.string().regex(/^(?:[0-9a-f]{2}){1,256}$/),
  }),
]);
export type TranslationPushDestination = z.infer<typeof destination>;

const registration = z.object({
  author: hexKey,
  transport: hexKey,
  destination,
});
type Registration = z.infer<typeof registration>;

const proofSchema = z.object({
  id: hexKey,
  sig: z.string().regex(/^[0-9a-f]{128}$/),
  pubkey: hexKey,
  kind: z.literal(27235),
  created_at: z.int().positive(),
  content: z.literal(''),
  tags: z.array(z.tuple([z.string(), z.string()])).length(4),
});
const registrationRequest = registration.extend({ proof: proofSchema });

interface RegistrationScope {
  user: Types.ObjectId;
  session: Types.ObjectId;
  refreshExpiresAt: Date;
}
export interface AlertRegistrationRecord {
  _id: string;
  user: Types.ObjectId;
  session: Types.ObjectId;
  author: string;
  destination: TranslationPushDestination;
  expiresAt: Date;
}
interface AlertChallengeRecord {
  _id: string;
  user: Types.ObjectId;
  session: Types.ObjectId;
  transport: string;
  digest: string;
  issuedAt: number;
  expiresAt: Date;
}

function challenges() {
  return mongoose.model<AlertChallengeRecord>('NostranslationAlertChallenge');
}

export function alertRegistrations() {
  return mongoose.model<AlertRegistrationRecord>(
    'NostranslationAlertRegistration',
  );
}

function digest(record: Registration): string {
  const { destination } = record;
  const fields =
    destination.platform === 'ios'
      ? [destination.platform, destination.token]
      : [
          destination.platform,
          destination.endpoint,
          destination.publicKey,
          destination.auth,
        ];
  return createHash('sha256')
    .update(
      [record.author, record.transport, ...fields]
        .map(field => Buffer.byteLength(field) + ':' + field)
        .join(''),
    )
    .digest('hex');
}

function canRegister(record: Registration): boolean {
  return (
    record.author !== record.transport &&
    (record.destination.platform === 'ios' ||
      unifiedPush.validRegistration(record.destination))
  );
}

function proofTags(nonce: string, registrationDigest: string): string[][] {
  return [
    [
      'u',
      `${config.https ? 'https' : 'http'}://${config.domain}${translationAlertsPath}`,
    ],
    ['method', 'PUT'],
    ['challenge', nonce],
    ['payload', registrationDigest],
  ];
}

export async function newTranslationAlertChallenge(
  scope: RegistrationScope,
  raw: unknown,
) {
  const input = registration.safeParse(raw);
  if (!input.success || !canRegister(input.data)) return;
  const nonce = randomBytes(32).toString('hex');
  const issuedAt = Math.floor(Date.now() / 1000);
  const registrationDigest = digest(input.data);
  await challenges().create({
    _id: nonce,
    user: scope.user,
    session: scope.session,
    transport: input.data.transport,
    digest: registrationDigest,
    issuedAt,
    expiresAt: new Date((issuedAt + lifetime) * 1000),
  });
  return {
    kind: 27235,
    content: '',
    created_at: issuedAt,
    tags: proofTags(nonce, registrationDigest),
  };
}

export async function registerTranslationAlert(
  scope: RegistrationScope,
  raw: unknown,
): Promise<boolean> {
  const input = registrationRequest.safeParse(raw);
  if (!input.success || !canRegister(input.data)) return false;
  const record = input.data;
  const { proof } = record;
  const nonce = proof.tags.find(tag => tag[0] === 'challenge')?.[1];
  if (
    !nonce ||
    !hexKey.safeParse(nonce).success ||
    proof.pubkey !== record.transport
  )
    return false;
  const registrationDigest = digest(record);
  const tags = proofTags(nonce, registrationDigest);
  const signedTags = new Map(proof.tags);
  if (
    !tags.every(([name, value]) => signedTags.get(name) === value) ||
    !verifyEvent(proof)
  )
    return false;

  const consumed = await challenges().findOneAndDelete({
    _id: { $eq: nonce },
    user: scope.user,
    session: scope.session,
    transport: { $eq: record.transport },
    digest: registrationDigest,
    issuedAt: proof.created_at,
    expiresAt: { $gt: new Date() },
  });
  if (!consumed) return false;
  try {
    await alertRegistrations().updateOne(
      { _id: { $eq: record.transport }, user: scope.user },
      {
        $set: {
          session: scope.session,
          author: record.author,
          destination: record.destination,
          expiresAt: scope.refreshExpiresAt,
        },
      },
      { upsert: true },
    );
    return true;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    )
      return false;
    throw error;
  }
}

export async function unregisterTranslationAlert(
  scope: RegistrationScope,
  transport: unknown,
): Promise<boolean> {
  const parsed = hexKey.safeParse(transport);
  if (!parsed.success) return false;
  await alertRegistrations().deleteOne({
    _id: { $eq: parsed.data },
    user: scope.user,
    session: scope.session,
  });
  return true;
}
