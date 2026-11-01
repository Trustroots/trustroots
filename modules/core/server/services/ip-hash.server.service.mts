import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import config from '../../../../config/config.mts';

/** Stable equality identifier; raw addresses are never returned or logged here. */
export function hashIpAddress(
  address: string | undefined,
  secret: string = config.ipHashSecret,
): string | undefined {
  if (!secret || !address || address.includes('%') || !isIP(address))
    return undefined;
  if (Buffer.byteLength(secret) < 32)
    throw new Error(
      'IP hashing requires a dedicated secret of at least 32 bytes.',
    );

  const canonical = ipaddr.process(address).toString();
  return createHmac('sha256', secret)
    .update(`trustroots:ip:v1:${canonical}`)
    .digest('hex');
}
