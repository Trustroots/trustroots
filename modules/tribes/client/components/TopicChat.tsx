import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useId, useState } from 'react';
import type { Event } from 'nostr-tools';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
import { useTranslation } from 'react-i18next';
import http from '@trustroots/core/http-client';
import type { UserProfile } from '@/modules/users/client/types';
import { MAX_CHAT_LENGTH, type ChatRoom } from '../../shared/circle-chat';
import useCircleProfileUsernames from '../hooks/useCircleProfileUsernames';
import CircleChatLog from './CircleChatLog';
import './radio-circle.less';

type Member = Pick<UserProfile, '_id'>;

const rooms = {
  hackers: { title: 'Hackers chat', path: '/circles/hackers' },
  volunteering: { title: 'Volunteering chat', path: '/volunteering' },
  radio: { title: 'Radio chat', path: '/circles/radio' },
  hitchhikers: { title: 'Hitchhikers chat', path: '/circles/hitchhikers' },
} as const;

interface ChatSnapshot {
  messages: Event[];
  servicePubkey: string;
}

export default function TopicChat({
  roomName,
  user,
  isCircleMember = false,
  channel,
  stationLink,
}: {
  roomName: ChatRoom;
  user?: Member;
  isCircleMember?: boolean;
  channel?: string;
  stationLink?: (event: Event) => React.ReactNode;
}) {
  const { t } = useTranslation('circles');
  const { title, path } = rooms[roomName];
  const canUseChat = Boolean(
    user && (roomName === 'volunteering' || isCircleMember),
  );
  const messageId = useId();
  const descriptionId = useId();
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState(false);
  const [sending, setSending] = useState(false);
  const url = `/api/tribes/chat/${roomName}`;
  const queryClient = useQueryClient();
  const queryKey = [
    'circle-chat',
    roomName,
    canUseChat ? user?._id : undefined,
  ];
  const chat = useQuery({
    queryKey,
    enabled: canUseChat,
    queryFn: async ({ signal }) =>
      (await http.get<ChatSnapshot>(url, { signal })).data,
    refetchInterval: 10_000,
    retry: false,
  });
  const messages = (canUseChat ? [...(chat.data?.messages ?? [])] : []).sort(
    (first, second) =>
      first.created_at - second.created_at || first.id.localeCompare(second.id),
  );
  const usernames = useCircleProfileUsernames(
    messages
      .filter(event => event.pubkey !== chat.data?.servicePubkey)
      .map(({ pubkey }) => pubkey),
  );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!canUseChat || !content || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const { data: posted } = await http.post<Event>(url, {
        content,
        channel,
      });
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<ChatSnapshot>(queryKey, snapshot => ({
        servicePubkey: posted.pubkey,
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
      {canUseChat ? (
        <>
          {chat.isPending && <p role="status">{t('Loading messages…')}</p>}
          {chat.isError && (
            <div className="radio-chat-recovery">
              <p role="status">{t('Could not load chat messages.')}</p>
              <Button
                type="button"
                disabled={chat.isFetching}
                onClick={() => void chat.refetch()}
              >
                {chat.isFetching
                  ? t('Loading messages…')
                  : t('Retry loading messages')}
              </Button>
            </div>
          )}
          {chat.isSuccess && messages.length === 0 && (
            <p role="status">{t('No messages yet.')}</p>
          )}
          <CircleChatLog
            messages={messages}
            usernames={usernames}
            servicePubkey={chat.data?.servicePubkey}
            stationLink={stationLink}
          />
          <form
            onSubmit={send}
            className="radio-chat-form"
            aria-describedby={descriptionId}
          >
            <label htmlFor={messageId}>{t('Message')}</label>
            <Input
              id={messageId}
              maxLength={MAX_CHAT_LENGTH}
              placeholder={t('Write a message…')}
              value={message}
              onChange={event => setMessage(event.target.value)}
              disabled={sending}
            />
            <Button
              intent="primary"
              type="submit"
              disabled={!message.trim() || sending}
            >
              {sending ? t('Sending…') : t('Send')}
            </Button>
          </form>
          {sendError && (
            <p role="alert">{t('Message could not be sent. Try again.')}</p>
          )}
          <p id={descriptionId} className="radio-chat-description">
            {t('Trustroots signs your posts and includes your username.')}{' '}
            {t(
              'Messages are visible to people with access to the Trustroots relay.',
            )}
          </p>
        </>
      ) : user ? (
        <p>
          {t(
            'Join this circle using the Join button at the top of the page to read or post in chat.',
          )}
        </p>
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
