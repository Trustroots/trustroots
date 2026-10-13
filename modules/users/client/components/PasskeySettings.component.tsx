import React, { useEffect, useState } from 'react';
import * as api from '../api/passkeys.api';
import { readApiError } from '../utils/api-error';

export default function PasskeySettings() {
  const [keys, setKeys] = useState<api.MemberPasskey[]>([]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getPasskeys()
      .then(result => {
        if (active) setKeys(result);
      })
      .catch(() => {
        if (active) setError('Could not load passkeys.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setPassword('');
      setCode('');
      setLabel('');
      setKeys(await api.getPasskeys());
      setMessage(success);
    } catch (reason: unknown) {
      setError(
        readApiError(reason).message ||
          (reason instanceof Error
            ? reason.message
            : 'Passkey request was not completed.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      () => api.registerPasskey(password, code, label),
      'Passkey added.',
    );
  }

  return (
    <section className="panel panel-default" aria-labelledby="passkeys-title">
      <div className="panel-heading" id="passkeys-title">
        Staff passkeys
      </div>
      <div className="panel-body">
        <p>
          Add a device passkey or hardware key for sign-in after your password.
          Keep your authenticator and recovery codes available.
        </p>
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <form onSubmit={add}>
          <div className="form-group">
            <label htmlFor="passkey-password">Current password</label>
            <input
              id="passkey-password"
              type="password"
              autoComplete="current-password"
              className="form-control"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="passkey-code">Authenticator or recovery code</label>
            <input
              id="passkey-code"
              autoComplete="one-time-code"
              className="form-control"
              required
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="passkey-label">Passkey name</label>
            <input
              id="passkey-label"
              className="form-control"
              maxLength={64}
              required
              value={label}
              onChange={event => setLabel(event.target.value)}
            />
          </div>
          <button className="btn btn-default" type="submit" disabled={busy}>
            Add passkey
          </button>
        </form>
        <ul aria-label="Registered passkeys">
          {keys.map(key => (
            <li key={key.id}>
              {key.label}{' '}
              <button
                className="btn btn-link"
                type="button"
                disabled={busy || !password || !code}
                onClick={() =>
                  void run(
                    () => api.removePasskey(key.id, password, code),
                    'Passkey removed.',
                  )
                }
                aria-label={'Remove passkey ' + key.label}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
