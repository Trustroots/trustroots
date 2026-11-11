import React from 'react';
import { npubEncode } from 'nostr-tools/nip19';

export default function CircleNostrIdentity({
  pubkey,
  username,
}: {
  pubkey: string;
  username?: string;
}) {
  const npub = npubEncode(pubkey);
  if (!username) return <span>{npub}</span>;

  return (
    <a href={`/profile/${encodeURIComponent(username)}`} title={npub}>
      {username}@trustroots.org
    </a>
  );
}
