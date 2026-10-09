import React, { useEffect, useState } from 'react';
import {
  cancelAdminPassword,
  isAdminElevationPending,
  submitAdminPassword,
} from '../api/admin-elevation';

export default function AdminElevationPrompt() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const openPrompt = () => {
      setPassword('');
      setError('');
      setOpen(true);
    };
    window.addEventListener('trustroots:admin-elevation', openPrompt);
    if (isAdminElevationPending()) {
      openPrompt();
    }
    return () => {
      window.removeEventListener('trustroots:admin-elevation', openPrompt);
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-elevation-title"
      className="admin-elevation-prompt"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: '1rem',
      }}
    >
      <form
        className="panel panel-default"
        style={{ maxWidth: 420, width: '100%', margin: 0, padding: '1.25rem' }}
        onSubmit={event => {
          event.preventDefault();
          if (!password) {
            setError('Enter your current password.');
            return;
          }
          setOpen(false);
          submitAdminPassword(password);
        }}
      >
        <h2 id="admin-elevation-title" className="h4">
          Confirm admin access
        </h2>
        <p>
          You stay signed in as a member. Enter your password to unlock admin
          tools for the next half hour.
        </p>
        <label htmlFor="admin-elevation-password">Current password</label>
        <input
          id="admin-elevation-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="form-control"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => {
              setOpen(false);
              cancelAdminPassword();
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
