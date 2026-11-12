import React, { useEffect, useId, useRef, useState } from 'react';
import type { Event } from 'nostr-tools';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '@/modules/users/client/types';
import useCircleSigner from '../hooks/useCircleSigner';
import useCircleProfileUsernames from '../hooks/useCircleProfileUsernames';
import {
  HACKERS_CHAT_TOPIC,
  RADIO_RELAYS,
  VOLUNTEERING_CHAT_TOPIC,
  RadioRoom,
} from '../services/radio.client.service';
import CircleChatLog from './CircleChatLog';
import './radio-circle.less';

export default function TopicChat({
  roomName,
  user,
}: {
  roomName: 'hackers' | 'volunteering';
  user?: Pick<UserProfile, '_id' | 'username' | 'nostrNpub'>;
}) {
  const { t } = useTranslation('circles');
  const isVolunteering = roomName === 'volunteering';
  const topic = isVolunteering ? VOLUNTEERING_CHAT_TOPIC : HACKERS_CHAT_TOPIC;
  const path = isVolunteering ? '/volunteering' : '/circles/hackers';
  const title = isVolunteering ? t('Volunteering chat') : t('Hackers chat');
  const messageId = useId();
  const {
    signer,
    connecting,
    error: signerError,
    connect,
  } = useCircleSigner(user);
  const [messages, setMessages] = useState<Event[]>([]);
  const usernames = useCircleProfileUsernames(
    user ? messages.map(({ pubkey }) => pubkey) : [],
  );
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState(false);
  const [relayError, setRelayError] = useState(false);
  const [sending, setSending] = useState(false);
  const room = useRef<RadioRoom | null>(null);

  useEffect(() => {
    if (!user) return;
    const connection = new RadioRoom(
      event => {
        setRelayError(false);
        setMessages(current =>
          current.some(item => item.id === event.id)
            ? current
            : [...current, event]
                .sort((first, second) => first.created_at - second.created_at)
                .slice(-200),
        );
      },
      () => setRelayError(true),
      topic,
    );
    room.current = connection;
    void connection.open(true);
    return () => {
      room.current = null;
      connection.close();
    };
  }, [topic, user?._id]);

  useEffect(() => {
    if (signer) room.current?.setSigner(signer);
  }, [signer]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const connection = room.current;
    const content = message.trim();
    if (!connection || !signer || !content || sending) return;
    setSending(true);
    setSendError(false);
    try {
      await connection.publish({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', topic]],
        content,
      });
      if (room.current === connection) setMessage('');
    } catch {
      if (room.current === connection) setSendError(true);
    } finally {
      if (room.current === connection) setSending(false);
    }
  }

  return (
    <section aria-label={title} className="topic-chat">
      <h3>{title}</h3>
      {user ? (
        <>
          <p>
            {t('Chat messages are published publicly to {{relays}}.', {
              relays: RADIO_RELAYS.join(', '),
            })}
          </p>
          {signer ? (
            <p role="status">
              {t('Connected as {{identity}}.', {
                identity: `${user.username}@trustroots.org`,
              })}
            </p>
          ) : (
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
          {signerError && <p role="alert">{t(signerError)}</p>}
          {sendError && (
            <p role="alert">{t('Message could not be sent. Try again.')}</p>
          )}
          {relayError && (
            <p role="status">
              {isVolunteering
                ? t('The volunteering chat is unavailable.')
                : t('The Hackers chat is unavailable.')}
            </p>
          )}
          <CircleChatLog messages={messages} usernames={usernames} />
          <form onSubmit={send} className="radio-chat-form">
            <label htmlFor={messageId}>{t('Message')}</label>
            <input
              id={messageId}
              maxLength={500}
              value={message}
              onChange={event => setMessage(event.target.value)}
              disabled={!signer || sending}
            />
            <Button
              intent="primary"
              type="submit"
              disabled={!signer || !message.trim() || sending}
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
