import {
  finalizeEvent,
  getPublicKey,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import {
  CHAT_ATTRIBUTION_TAG,
  chatTemplate,
  chatTopics,
  type ChatRoom,
} from '../../shared/circle-chat.ts';
import { withCircleChatRelay } from '../../shared/circle-chat-relay.ts';

function exportSigner() {
  const key = nip19.decode(process.env.TRUSTROOTS_NOSTR_EXPORT_NSEC || '');
  if (key.type !== 'nsec') throw new Error('Circle chat signer is unavailable');
  const { data } = key;
  return {
    publicKey: getPublicKey(data),
    sign: async (event: EventTemplate) => finalizeEvent(event, data),
  };
}

export async function readCircleChat(room: ChatRoom) {
  const { publicKey, sign } = exportSigner();
  const messages = await withCircleChatRelay(sign, relay => {
    return new Promise<Event[]>((resolve, reject) => {
      const limit = 200;
      const messages = new Map<string, Event>();
      relay.subscribe([{ kinds: [1], '#t': [chatTopics[room]], limit }], {
        onevent(event) {
          const now = Math.floor(Date.now() / 1000);
          if (
            !Number.isSafeInteger(event.created_at) ||
            event.created_at < 0 ||
            event.created_at > now + 60
          )
            return;
          if (
            room === 'radio' &&
            event.tags.some(
              ([name, value]) =>
                name === 't' &&
                (value === 'nowplaying' || value === 'favorite'),
            )
          )
            return;
          const expiration = event.tags.find(([name]) => name === 'expiration');
          if (expiration && Number(expiration[1]) <= Date.now() / 1000) return;
          if (messages.size < limit) messages.set(event.id, event);
        },
        oneose: () => resolve([...messages.values()]),
        onclose: reason => reject(new Error(reason)),
      });
    });
  });
  return { messages, servicePubkey: publicKey };
}

export async function publishCircleChat(
  room: ChatRoom,
  username: string,
  content: string,
  channel?: string,
) {
  const { sign } = exportSigner();
  const template = chatTemplate(room, content, channel);
  template.tags.push([CHAT_ATTRIBUTION_TAG, username]);
  const event = await sign(template);
  await withCircleChatRelay(sign, relay => relay.publish(event));
  return event;
}
