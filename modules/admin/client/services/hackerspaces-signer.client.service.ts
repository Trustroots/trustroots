import { nip19 } from 'nostr-tools';
import http from '@/modules/core/client/api/http-client.js';

export interface SigningIdentity {
  publicKey: string;
  npub: string;
  nip05?: string;
  lookupFailed?: boolean;
}

export function displayNostrKey(publicKey: string) {
  return nip19.npubEncode(publicKey);
}

export async function fetchSigningIdentity(
  publicKey: string,
): Promise<SigningIdentity> {
  const identity: SigningIdentity = {
    publicKey,
    npub: displayNostrKey(publicKey),
  };
  try {
    const { data } = await http.get('/api/admin/hackerspaces/signer', {
      params: { publicKey },
    });
    if (typeof data.nip05 === 'string') identity.nip05 = data.nip05;
  } catch {
    identity.lookupFailed = true;
  }
  return identity;
}
