import { useLocation, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';
import { nip19, type Event } from 'nostr-tools';
import useCircleSigner from '../hooks/useCircleSigner';
import CircleChatLog from './CircleChatLog';
import type { UserProfile } from '@/modules/users/client/types';
import {
  activeListeners,
  eventType,
  FAVOURITES_KEY,
  mergeFavourites,
  RadioRoom,
  readFavourites,
  roomTemplate,
  saveFavourites,
  stationFromHash,
  stationGroups,
  stations,
  tag,
  type Station,
} from '../services/radio.client.service';
import './radio-circle.less';

export default function RadioCircle({ user }: { user?: UserProfile }) {
  const { t } = useTranslation('circles');
  const audio = useRef<HTMLAudioElement>(null);
  const room = useRef<RadioRoom | undefined>(undefined);
  const mounted = useRef(false);
  const playRequest = useRef(0);
  const localFavouriteActions = useRef(new Map<string, boolean>());
  const hash = useLocation({ select: location => location.hash });
  const navigate = useNavigate();
  const [station, setStation] = useState(() => stationFromHash(hash));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [relayError, setRelayError] = useState(false);
  const {
    signer,
    connecting,
    error: signerError,
    connect,
  } = useCircleSigner(user);
  const [events, setEvents] = useState<Event[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const favouritesKey = user ? `${FAVOURITES_KEY}:${user._id}` : FAVOURITES_KEY;
  const [favourites, setFavourites] = useState(() =>
    readFavourites(favouritesKey),
  );
  const listeners = useMemo(() => activeListeners(events, now), [events, now]);
  const chat = events
    .filter(
      event =>
        eventType(event) === 'chat' &&
        Number(tag(event, 'expiration') || Infinity) > now,
    )
    .sort((a, b) => a.created_at - b.created_at)
    .slice(-200);
  const linkedNpub = user?.nostrNpub;
  const ownPublicKey = useMemo(() => {
    if (!linkedNpub) return undefined;
    try {
      const decoded = nip19.decode(linkedNpub);
      return decoded.type === 'npub' ? decoded.data : undefined;
    } catch {
      return undefined;
    }
  }, [linkedNpub]);
  const includesLocalListener =
    playing &&
    !listeners.some(
      listener => listener.pubkey === (signer?.publicKey ?? ownPublicKey),
    );
  const listenerCount = listeners.length + Number(includesLocalListener);

  useEffect(() => {
    mounted.current = true;
    const connection = new RadioRoom(
      event => {
        setRelayError(false);
        setEvents(previous => {
          if (previous.some(item => item.id === event.id)) return previous;
          // Keep the newest listening event per key and bound retained room history.
          const retained =
            eventType(event) === 'listening'
              ? previous.filter(
                  item =>
                    eventType(item) !== 'listening' ||
                    item.pubkey !== event.pubkey ||
                    item.created_at > event.created_at,
                )
              : previous;
          return [...retained, event]
            .sort((a, b) => a.created_at - b.created_at)
            .slice(-1000);
        });
      },
      () => setRelayError(true),
    );
    room.current = connection;
    void connection.open(Boolean(user));
    const timer = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      15000,
    );
    const player = audio.current!;
    return () => {
      mounted.current = false;
      playRequest.current++;
      clearInterval(timer);
      connection.close();
      player.pause();
      player.removeAttribute('src');
      player.load();
    };
  }, [user]);

  useEffect(() => {
    if (!signer) return;
    room.current?.setSigner(signer);
    room.current?.loadFavourites(signer.publicKey);
  }, [signer, user]);

  useEffect(() => {
    const next = stationFromHash(hash);
    if (next && next.id !== station?.id) {
      playRequest.current++;
      audio.current!.pause();
      setPlaying(false);
      setStation(next);
      setError('');
    }
  }, [hash]);

  useEffect(() => {
    if (!signer) return;
    setFavourites(previous => {
      const merged = mergeFavourites(
        previous,
        events.filter(event => event.pubkey === signer.publicKey),
      );
      // Choices made in this session survive old relay history and failed writes.
      localFavouriteActions.current.forEach((starred, id) => {
        const index = merged.indexOf(id);
        if (starred && index < 0) merged.push(id);
        if (!starred && index >= 0) merged.splice(index, 1);
      });
      return merged;
    });
  }, [events, signer]);
  useEffect(() => {
    saveFavourites(favourites, favouritesKey);
  }, [favourites, favouritesKey]);

  useEffect(() => {
    if (!signer || !station || !playing) return;
    let cancelled = false;
    let timer: number;
    const share = async () => {
      try {
        await room.current!.publish(
          roomTemplate('listening', station, station.title),
        );
      } catch {
        if (!cancelled)
          setSocialError(t('Could not share listening activity.'));
      }
      if (!cancelled) timer = window.setTimeout(share, 5 * 60 * 1000);
    };
    timer = window.setTimeout(share, 10000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [station, playing, signer, t]);

  async function play(next: Station) {
    const request = ++playRequest.current;
    const player = audio.current!;
    setError('');
    if (station?.id === next.id && playing) {
      player.pause();
      setPlaying(false);
      return;
    }
    player.pause();
    setPlaying(false);
    setStation(next);
    void navigate({ hash: next.id, replace: true, search: true, to: '.' });
    if (player.getAttribute('src') !== next.url) player.src = next.url;
    try {
      await player.play();
      if (mounted.current && request === playRequest.current) setPlaying(true);
    } catch {
      if (mounted.current && request === playRequest.current)
        setError(
          t(
            'This station could not be played. Try again or choose another station.',
          ),
        );
    }
  }
  function favourite(next: Station) {
    const starred = !favourites.includes(next.id);
    localFavouriteActions.current.set(next.id, starred);
    setFavourites(previous =>
      starred ? [...previous, next.id] : previous.filter(id => id !== next.id),
    );
    if (signer)
      void room
        .current!.publish(
          roomTemplate(
            'favourite',
            next,
            `${starred ? '⭐' : '☆'} ${next.title} #radiostr #favorite`,
            starred,
          ),
        )
        .catch(() => {
          if (mounted.current)
            setSocialError(
              t('Favourite saved on this device, but could not be shared.'),
            );
        });
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || !signer || sending) return;
    setSending(true);
    setSocialError('');
    try {
      await room.current!.publish(roomTemplate('chat', station, text));
      if (mounted.current) setMessage('');
    } catch {
      if (mounted.current)
        setSocialError(t('Message could not be sent. Try again.'));
    } finally {
      if (mounted.current) setSending(false);
    }
  }
  function stationList(label: string, items: Station[]) {
    return (
      <section className="radio-station-group" key={label} aria-label={label}>
        <h4>{label}</h4>
        <ul>
          {items.map(item => (
            <li
              key={item.id}
              className={station?.id === item.id ? 'is-selected' : ''}
            >
              <button
                type="button"
                className="radio-tune"
                onClick={() => void play(item)}
                aria-label={`${playing && station?.id === item.id ? t('Pause') : t('Play')} ${item.title}`}
              >
                <span className="radio-station-art" aria-hidden="true">
                  {item.title.slice(0, 2)}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.tags.join(' · ')}</small>
                </span>
              </button>
              <button
                type="button"
                className="radio-favourite"
                aria-label={`${favourites.includes(item.id) ? t('Unstar') : t('Star')} ${item.title}`}
                aria-pressed={favourites.includes(item.id)}
                onClick={() => favourite(item)}
              >
                {favourites.includes(item.id) ? '★' : '☆'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  function identityLabel(key: string) {
    return `${key.slice(0, 8)}…${key.slice(-4)}`;
  }

  return (
    <section
      className={`container radio-circle${user ? '' : ' radio-circle-public'}`}
      aria-label={t('Trustroots Radio')}
    >
      <div className="radio-player-panel">
        <div className="radio-now-playing">
          <div>
            <p>{playing ? t('Now playing') : t('Ready to listen')}</p>
            <h3>{station?.title || t('Pick a station')}</h3>
          </div>
          {station && (
            <Button
              intent="primary"
              type="button"
              onClick={() => void play(station)}
            >
              {playing ? t('Pause') : t('Play')}
            </Button>
          )}
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Third-party live radio streams do not supply caption tracks. */}
        <audio
          ref={audio}
          preload="none"
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            playRequest.current++;
            setPlaying(false);
            setError(
              t(
                'This station could not be played. Try again or choose another station.',
              ),
            );
          }}
        />
        {error && <p role="alert">{error}</p>}
        <p aria-live="polite">
          {includesLocalListener
            ? listenerCount === 1
              ? t('One listener, including you on this device')
              : t('{{count}} listeners, including you on this device', {
                  count: listenerCount,
                })
            : listenerCount === 1
              ? t('One shared listener')
              : t('{{count}} shared listeners', { count: listenerCount })}
        </p>
        {relayError && (
          <p role="status">
            {t(
              'The radio room is unavailable. You can still listen and save favourites.',
            )}
          </p>
        )}
        {!user && (
          <p>
            <a href="/signin?redirect=/circles/radio">
              {t('Log in to see listeners and chat.')}
            </a>
          </p>
        )}
        {user && (
          <section aria-label={t('Listening now')}>
            <h4>{t('Listening now')}</h4>
            {!listeners.length && (
              <p>{t('No shared listening activity yet.')}</p>
            )}
            <ul>
              {listeners.map(listener => (
                <li key={listener.pubkey}>
                  <span>{identityLabel(listener.pubkey)}</span>
                  {' · '}
                  <a
                    href={`/circles/radio#${encodeURIComponent(tag(listener, 'radiostr_station') ?? '')}`}
                  >
                    {stations.find(
                      item => item.id === tag(listener, 'radiostr_station'),
                    )?.title || listener.content}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {favourites.length > 0 &&
          stationList(
            t('Favourites'),
            favourites.map(id => stations.find(item => item.id === id)!),
          )}
        {stationGroups.map(group => stationList(group.name, group.stations))}
      </div>
      {user && (
        <section className="radio-social-panel" aria-label={t('Radio chat')}>
          <h3>{t('Chat')}</h3>
          <p>
            {t(
              'Radio messages and listening activity are shared publicly on Nostr.',
            )}
          </p>
          {!signer ? (
            <>
              <Button
                type="button"
                disabled={connecting}
                onClick={() => {
                  setSocialError('');
                  void connect();
                }}
              >
                {connecting ? t('Connecting…') : t('Connect Nostr identity')}
              </Button>
              <p>
                {t(
                  'Connect the Nostr key linked to your Trustroots profile to chat and automatically share what you are listening to.',
                )}
              </p>
              <a href="/profile/edit/networks">{t('Edit linked Nostr key')}</a>
            </>
          ) : (
            <p role="status">
              {t(
                'Connected as {{identity}}. Listening activity is shared automatically.',
                { identity: `${user.username}@trustroots.org` },
              )}
            </p>
          )}
          {(socialError || signerError) && (
            <p role="alert">{socialError || t(signerError)}</p>
          )}
          <CircleChatLog
            messages={chat}
            stationLink={event => {
              const channel = tag(event, 'channel');
              return stations.some(item => item.id === channel) ? (
                <>
                  {' '}
                  <a href={`/circles/radio#${channel}`}>#{channel}</a>
                </>
              ) : null;
            }}
          />
          <form onSubmit={send} className="radio-chat-form">
            <label htmlFor="radio-message">{t('Message')}</label>
            <input
              id="radio-message"
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
        </section>
      )}
    </section>
  );
}
