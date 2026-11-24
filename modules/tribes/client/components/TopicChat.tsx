import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useId, useState } from 'react';
import type { Event } from 'nostr-tools';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';
import http from '@/modules/core/client/api/http-client';
import type { UserProfile } from '@/modules/users/client/types';
import {
  MAX_CHAT_LENGTH,
  chatTemplate,
  type ChatRoom,
} from '../../shared/circle-chat';
import { withCircleChatRelay } from '../../shared/circle-chat-relay';
import useCircleSigner from '../hooks/useCircleSigner';
import useCircleProfileUsernames from '../hooks/useCircleProfileUsernames';
import CircleChatLog from './CircleChatLog';
import './radio-circle.less';

type Member = Pick<UserProfile, '_id' | 'username' | 'nostrNpub'>;

const rooms = {
  hackers: { title: 'Hackers chat', path: '/circles/hackers' },
  volunteering: { title: 'Volunteering chat', path: '/volunteering' },
  radio: { title: 'Radio chat', path: '/circles/radio' },
  hitchhikers: { title: 'Hitchhikers chat', path: '/circles/hitchhikers' },
} as const;

interface TopicChatProps {
  roomName: ChatRoom;
  user?: Member;
}

interface ChatSnapshot {
  messages: Event[];
  servicePubkey: string;
}

export default function TopicChat({ roomName, user }: TopicChatProps) {
  const signing = useCircleSigner(user);
  return <CircleRoomChat roomName={roomName} user={user} signing={signing} />;
}

export function CircleRoomChat({
  roomName,
  user,
  signing,
  channel,
  stationLink,
}: TopicChatProps & {
  signing: ReturnType<typeof useCircleSigner>;
  channel?: string;
  stationLink?: (event: Event) => React.ReactNode;
}) {
  const { t } = useTranslation('circles');
  const { title, path } = rooms[roomName];
  const { signer, connecting, error: signerError, connect } = signing;
  const messageId = useId();
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState(false);
  const [sending, setSending] = useState(false);
  const url = `/api/tribes/chat/${roomName}`;
  const queryClient = useQueryClient();
  const queryKey = ['circle-chat', roomName, user?._id];
  const chat = useQuery({
    queryKey,
    enabled: Boolean(user),
    queryFn: async ({ signal }) =>
      (await http.get<ChatSnapshot>(url, { signal })).data,
    refetchInterval: 10_000,
    retry: false,
  });
  const messages = [...(chat.data?.messages ?? [])].sort(
    (first, second) =>
      first.created_at - second.created_at || first.id.localeCompare(second.id),
  );
  const usernames = useCircleProfileUsernames(
    messages
      .filter(event => event.pubkey !== chat.data?.servicePubkey)
      .map(({ pubkey }) => pubkey),
  );
  const canSend = Boolean(user && (!user.nostrNpub || signer));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!canSend || !content || sending) return;
    setSending(true);
    setSendError(false);
    try {
      let posted: Event;
      if (signer) {
        posted = await signer.sign(chatTemplate(roomName, content, channel));
        await withCircleChatRelay(signer.sign, relay => relay.publish(posted));
      } else {
        ({ data: posted } = await http.post<Event>(url, { content, channel }));
      }
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<ChatSnapshot>(queryKey, snapshot => ({
        servicePubkey: snapshot?.servicePubkey ?? (signer ? '' : posted.pubkey),
        messages: [
          ...(snapshot?.messages.filter(item => item.id !== posted.id) ?? []),
          posted,
        ],
      }));
      setMessage('');
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label={t(title)}
      className={roomName === 'radio' ? 'radio-social-panel' : 'topic-chat'}
    >
      <h3>{t(title)}</h3>
      {user ? (
        <>
          <p>
            {t(
              'Messages are visible to people with access to the Trustroots relay.',
            )}
          </p>
          {signer && (
            <p role="status">
              {t('Connected as {{identity}}.', {
                identity: `${user.username}@trustroots.org`,
              })}
              {roomName === 'radio' && (
                <> {t('Listening activity is shared automatically.')}</>
              )}
            </p>
          )}
          {user.nostrNpub && !signer && (
            <>
              <Button
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
              >
                {connecting ? t('Connecting…') : t('Connect Nostr identity')}
              </Button>{' '}
              <a href="/profile/edit/networks">{t('Edit linked Nostr key')}</a>
            </>
          )}
          {!user.nostrNpub && (
            <p>
              {t('Trustroots signs your posts and includes your username.')}
            </p>
          )}
          {signerError && <p role="alert">{t(signerError)}</p>}
          {sendError && (
            <p role="alert">{t('Message could not be sent. Try again.')}</p>
          )}
          {chat.isError && (
            <p role="status">{t('Circle chat is temporarily unavailable.')}</p>
          )}
          <CircleChatLog
            messages={messages}
            usernames={usernames}
            servicePubkey={chat.data?.servicePubkey}
            stationLink={stationLink}
          />
          <form onSubmit={send} className="radio-chat-form">
            <label htmlFor={messageId}>{t('Message')}</label>
            <input
              id={messageId}
              maxLength={MAX_CHAT_LENGTH}
              value={message}
              onChange={event => setMessage(event.target.value)}
              disabled={!canSend || sending}
            />
            <Button
              intent="primary"
              type="submit"
              disabled={!canSend || !message.trim() || sending}
            >
              {t('Send')}
            </Button>
          </form>
        </>
      ) : (
        <p>
          <a
            href={`/signin?continue=true&returnTo=${encodeURIComponent(path)}`}
          >
            {t('Log in to see chat.')}
          </a>
        </p>
      )}
    </section>
  );
}
