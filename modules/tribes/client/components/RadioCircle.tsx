import { useLocation, useNavigate } from '@tanstack/react-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { useTranslation } from 'react-i18next';
import { nip19, type Event } from 'nostr-tools';
import useCircleProfileUsernames from '../hooks/useCircleProfileUsernames';
import TopicChat from './TopicChat';
import CircleNostrIdentity from './CircleNostrIdentity';
import type { UserProfile } from '@/modules/users/client/types';
import {
  activeListeners,
  FAVOURITES_KEY,
  RadioRoom,
  readFavourites,
  saveFavourites,
  stationFromHash,
  stationGroups,
  stations,
  tag,
  type Station,
} from '../services/radio.client.service';
import './radio-circle.less';

export default function RadioCircle({
  user,
  isCircleMember,
}: {
  user?: UserProfile;
  isCircleMember?: boolean;
}) {
  const { t } = useTranslation('circles');
  const audio = useRef<HTMLAudioElement>(null);
  const mounted = useRef(false);
  const playRequest = useRef(0);
  const hash = useLocation({ select: location => location.hash });
  const navigate = useNavigate();
  const [station, setStation] = useState(() => stationFromHash(hash));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [relayError, setRelayError] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const favouritesKey = user ? `${FAVOURITES_KEY}:${user._id}` : FAVOURITES_KEY;
  const [favourites, setFavourites] = useState(() =>
    readFavourites(favouritesKey),
  );
  const listeners = useMemo(() => activeListeners(events, now), [events, now]);
  const usernames = useCircleProfileUsernames(
    user ? listeners.map(({ pubkey }) => pubkey) : [],
  );
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
    playing && !listeners.some(listener => listener.pubkey === ownPublicKey);
  const listenerCount = listeners.length + Number(includesLocalListener);

  useEffect(() => {
    mounted.current = true;
    const connection = new RadioRoom(
      event => {
        setRelayError(false);
        setEvents(previous => {
          if (previous.some(item => item.id === event.id)) return previous;
          // Keep the newest listening event per key and bound retained room history.
          const retained = previous.filter(
            item =>
              item.pubkey !== event.pubkey ||
              item.created_at >= event.created_at,
          );
          return [...retained, event]
            .sort((a, b) => a.created_at - b.created_at)
            .slice(-1000);
        });
      },
      () => setRelayError(true),
    );
    void connection.open();
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
    saveFavourites(favourites, favouritesKey);
  }, [favourites, favouritesKey]);

  async function play(next: Station, { pauseIfPlaying = true } = {}) {
    const alreadyPlaying = station?.id === next.id && playing;
    if (alreadyPlaying && !pauseIfPlaying) return;

    const request = ++playRequest.current;
    const player = audio.current!;
    setError('');
    if (alreadyPlaying) {
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
    setFavourites(previous =>
      starred ? [...previous, next.id] : previous.filter(id => id !== next.id),
    );
  }
  function stationList(label: string, items: Station[]) {
    return (
      <section className="radio-station-group" key={label} aria-label={label}>
        <h4>{label}</h4>
        <ul>
          {items.map(item => {
            const hasArtwork = item.img && item.site;
            const initials = item.title.slice(0, 2);
            return (
              <li
                key={item.id}
                className={station?.id === item.id ? 'is-selected' : ''}
              >
                {hasArtwork && (
                  <a
                    className="radio-station-art radio-station-art-link"
                    href={item.site}
                    aria-label={t('{{station}} website', {
                      station: item.title,
                    })}
                  >
                    <span aria-hidden="true">{initials}</span>
                    <img
                      src={item.img}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={event => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  </a>
                )}
                <button
                  type="button"
                  className="radio-tune"
                  onClick={() => void play(item)}
                  aria-label={`${playing && station?.id === item.id ? t('Pause') : t('Play')} ${item.title}`}
                >
                  {!hasArtwork && (
                    <span className="radio-station-art" aria-hidden="true">
                      {initials}
                    </span>
                  )}
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
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section
      className={`tw:page-container radio-circle${user ? '' : ' radio-circle-public'}`}
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
              aria-label={playing ? t('Pause') : t('Play')}
              onClick={() => void play(station)}
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                {playing ? (
                  <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
                ) : (
                  <path d="M6 3v14l11-7z" />
                )}
              </svg>
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
              {t('Log in to see listeners.')}
            </a>
          </p>
        )}
        {user && (
          <section className="radio-listeners" aria-label={t('Listening now')}>
            <h4>{t('Listening now')}</h4>
            {!listeners.length && (
              <p>{t('No shared listening activity yet.')}</p>
            )}
            <ul>
              {listeners.map(listener => (
                <li key={listener.pubkey}>
                  <CircleNostrIdentity
                    pubkey={listener.pubkey}
                    username={usernames[listener.pubkey]}
                  />
                  {' · '}
                  <a
                    href={`/circles/radio#${encodeURIComponent(tag(listener, 'radiostr_station')!)}`}
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
        <TopicChat
          roomName="radio"
          user={user}
          isCircleMember={isCircleMember}
          channel={station?.id}
          stationLink={event => {
            const channel = tag(event, 'channel');
            const next = stations.find(item => item.id === channel);
            return next ? (
              <>
                {' '}
                <a
                  href={`/circles/radio#${next.id}`}
                  onClick={event => {
                    if (
                      event.button !== 0 ||
                      event.altKey ||
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    void play(next, { pauseIfPlaying: false });
                  }}
                >
                  #{next.id}
                </a>
              </>
            ) : null;
          }}
        />
      )}
    </section>
  );
}
