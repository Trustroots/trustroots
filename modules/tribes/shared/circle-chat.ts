import type { EventTemplate } from 'nostr-tools';

export const MAX_CHAT_LENGTH = 500;
export const CHAT_ATTRIBUTION_TAG = 'trustroots_username';

export const chatTopics = {
  hackers: 'trustroots-circle-hackers',
  volunteering: 'trustroots-volunteering',
  radio: 'radiostr',
  hitchhikers: 'trustroots-circle-hitchhikers',
} as const;

export type ChatRoom = keyof typeof chatTopics;

export function chatTemplate(
  room: ChatRoom,
  content: string,
  channel?: string,
): EventTemplate {
  const created_at = Math.floor(Date.now() / 1000);
  const tags = [['t', chatTopics[room]]];
  if (room === 'radio') {
    tags.push(['expiration', String(created_at + 30 * 24 * 60 * 60)]);
    if (channel) tags.push(['channel', channel]);
  }
  return { kind: 1, created_at, tags, content };
}
