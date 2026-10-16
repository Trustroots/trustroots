import React, { useEffect, useState } from 'react';
import http, { getErrorMessage } from '../api/http-client';
import { viewNavigation } from '../services/member-view';
import { signout } from '../react-app/shell-helpers';

export default function MemberViewBanner() {
  const view = window.viewContext;
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (view?.username && !view.expired && now >= view.expiresAt!)
      viewNavigation.reload();
  }, [now, view]);
  useEffect(() => {
    async function checkContext() {
      try {
        const { data } = await http.get('/api/auth/session');
        if (
          (data.viewGeneration || '') !== (view?.generation || '') ||
          (data.userId || '') !== (window.user?._id || '')
        )
          viewNavigation.reload();
      } catch {
        setError(
          'Could not check your account view. Reload before continuing.',
        );
      }
    }
    function changed(event: StorageEvent) {
      if (event.key === 'trustroots-view-change') viewNavigation.reload();
    }
    window.addEventListener('focus', checkContext);
    window.addEventListener('storage', changed);
    const timer = view?.username
      ? window.setInterval(() => setNow(Date.now()), 1000)
      : undefined;
    return () => {
      window.removeEventListener('focus', checkContext);
      window.removeEventListener('storage', changed);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [view]);
  if (!view?.username) return null;
  const expired = view.expired || now >= view.expiresAt!;
  async function leave() {
    setPending(true);
    setError('');
    try {
      const { data } = await http.post('/api/auth/masquerade/stop');
      viewNavigation.transition(data.redirect);
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Could not return to your account. Try again or sign out.',
        ),
      );
      setPending(false);
    }
  }
  return (
    <aside
      aria-label="Member view"
      className="alert alert-warning"
      style={{
        position: 'sticky',
        top: 'var(--tr-header-height, 0px)',
        zIndex: 1000,
      }}
    >
      <strong>Viewing as {view.username} — read-only.</strong>{' '}
      {expired
        ? 'This member view has ended.'
        : `Ends at ${new Date(view.expiresAt!).toLocaleTimeString()}.`}{' '}
      <button
        type="button"
        className="btn btn-default"
        disabled={pending}
        onClick={leave}
      >
        {pending ? 'Returning…' : 'Return to your account'}
      </button>{' '}
      <button type="button" className="btn btn-link" onClick={() => signout()}>
        Sign out
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
