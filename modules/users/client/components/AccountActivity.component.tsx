import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAccountActivity,
  type AccountActivityEvent,
  type AccountActivityEventType,
} from '../api/activity.api';

const EVENT_LABELS: Record<AccountActivityEventType, string> = {
  session_created: 'New session started',
  session_revoked: 'A session was signed out',
  sessions_signed_out: 'Sessions signed out',
  password_changed: 'Password changed',
  password_reset: 'Password reset',
  email_changed: 'Email address changed',
  mfa_enabled: 'Authenticator MFA enabled',
  mfa_disabled: 'Authenticator MFA disabled',
  recovery_codes_replaced: 'Recovery codes replaced',
  recovery_code_used: 'A recovery code was used',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AccountActivity() {
  const { t } = useTranslation('users') as {
    t: (key: string) => string;
  };
  const [events, setEvents] = useState<AccountActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading',
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    getAccountActivity()
      .then(page => {
        if (!active) return;
        setEvents(page.events);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
        setNextCursor(null);
        setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function loadMore(cursor: string) {
    setLoadingMore(true);
    try {
      const page = await getAccountActivity(cursor);
      setEvents(current => [...current, ...page.events]);
      setNextCursor(page.nextCursor);
    } catch {
      setStatus('unavailable');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section aria-labelledby="account-activity-title">
      <h2 id="account-activity-title">{t('Account activity')}</h2>
      <p>{t('Recent sign-ins and account changes are kept for 90 days.')}</p>
      <button
        type="button"
        className="btn btn-default"
        onClick={() => setRefreshKey(value => value + 1)}
      >
        {t('Refresh activity')}
      </button>
      {status === 'loading' && <p role="status">{t('Loading activity…')}</p>}
      {status === 'unavailable' && (
        <p role="status">{t('Could not load account activity. Try again.')}</p>
      )}
      {status === 'ready' && events.length === 0 && (
        <p>{t('No recent account activity.')}</p>
      )}
      {events.length > 0 && (
        <ul aria-label={t('Recent account activity')}>
          {events.map((event, index) => (
            <li key={`${event.eventType}-${event.createdAt}-${index}`}>
              <span>{t(EVENT_LABELS[event.eventType])}</span>{' '}
              <time dateTime={event.createdAt}>
                {formatDate(event.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      {status === 'ready' && nextCursor && (
        <button
          type="button"
          className="btn btn-default"
          disabled={loadingMore}
          onClick={() => void loadMore(nextCursor)}
        >
          {loadingMore ? t('Loading activity…') : t('Load more activity')}
        </button>
      )}
    </section>
  );
}
