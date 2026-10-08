import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate } from '../../../core/client/services/client-runtime';
import axios from '../../../core/client/api/http-client';

interface MemberSession {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}
export default function MemberSessions() {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [sessions, setSessions] = useState<MemberSession[]>([]);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const { data } = await axios.get('/api/auth/sessions');
      setSessions(data);
    } catch {
      setMessage(t('Could not load your sessions.'));
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function revoke(session?: MemberSession) {
    setBusy(true);
    setMessage('');
    try {
      await axios.delete(
        '/api/auth/sessions' + (session ? '/' + session.id : ''),
        { data: { password } },
      );
      setPassword('');
      if (!session || session.current) {
        navigate('/signin', undefined, { reload: true });
      } else {
        await refresh();
        setMessage(t('Session signed out.'));
      }
    } catch {
      setMessage(
        t('Could not sign out the session. Check your password and try again.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="member-sessions-title">
      <h2 id="member-sessions-title">{t('Active sessions')}</h2>
      <p>
        {t(
          'Sign out a session you no longer use. Enter your password to confirm.',
        )}
      </p>
      <label htmlFor="session-password">
        {t('Password for session changes')}
      </label>
      <input
        id="session-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={event => setPassword(event.target.value)}
      />
      {message && <p role="status">{message}</p>}
      <ul>
        {sessions.map(session => (
          <li key={session.id}>
            {session.current ? t('This session') : t('Another session')} —{' '}
            {t('Signed in {{date}}; last active {{lastSeen}}', {
              date: new Date(session.createdAt).toLocaleString(),
              lastSeen: new Date(session.lastSeenAt).toLocaleString(),
            })}
            <button
              type="button"
              disabled={busy || !password}
              onClick={() => void revoke(session)}
            >
              {t('Sign out this session')}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || !password}
        onClick={() => void revoke()}
      >
        {t('Sign out everywhere')}
      </button>
    </section>
  );
}
