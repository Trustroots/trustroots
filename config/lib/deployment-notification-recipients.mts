import type { Connection } from 'mongoose';
import validator from 'validator';
import {
  isCanonicalProductionMailDomain,
  type applyMailSafety,
} from './mail-safety.mts';

export function canPreviewDeploymentNotificationRecipients(
  domain: string,
  mailMode: ReturnType<typeof applyMailSafety>,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.TRUSTROOTS_DEPLOYMENT_TIER === 'production' &&
    env.NODE_ENV === 'production' &&
    isCanonicalProductionMailDomain(domain) &&
    mailMode === 'live'
  );
}

export async function findDeploymentNotificationAddresses(
  db: NonNullable<Connection['db']>,
): Promise<Set<string>> {
  const users = db.collection<{ email?: unknown }>('users').find(
    {
      public: true,
      roles: { $in: ['welcome-team', 'admin'], $nin: ['suspended'] },
    },
    { projection: { _id: 0, email: 1 } },
  );
  const addresses = new Set<string>();
  for await (const { email } of users) {
    if (typeof email !== 'string') continue;
    const address = email.trim().toLowerCase();
    if (validator.isEmail(address)) addresses.add(address);
  }
  return addresses;
}
