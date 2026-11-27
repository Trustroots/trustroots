import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
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
      .catch(reason => {
        if (active) {
          setError(readApiError(reason).message || 'Could not load passkeys.');
        }
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
        <form
          className="tw:flex tw:max-w-lg tw:flex-col tw:gap-4"
          onSubmit={add}
        >
          <div className="tw:flex tw:flex-col tw:gap-1">
            <label htmlFor="passkey-password">Current password</label>
            <Input
              id="passkey-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1">
            <label htmlFor="passkey-code">Authenticator or recovery code</label>
            <Input
              id="passkey-code"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={event => setCode(event.target.value)}
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1">
            <label htmlFor="passkey-label">Passkey name</label>
            <Input
              id="passkey-label"
              maxLength={64}
              required
              value={label}
              onChange={event => setLabel(event.target.value)}
            />
          </div>
          <Button
            className="tw:self-start"
            intent="primary"
            type="submit"
            disabled={busy}
          >
            Add passkey
          </Button>
        </form>
        <ul
          aria-label="Registered passkeys"
          className="tw:mt-4 tw:grid tw:max-w-lg tw:list-none tw:gap-2 tw:p-0 tw:empty:hidden"
        >
          {keys.map(key => (
            <li
              className="tw:flex tw:items-center tw:justify-between tw:gap-3"
              key={key.id}
            >
              <span className="tw:min-w-0 tw:wrap-anywhere">{key.label}</span>
              <Button
                variant="link"
                size="sm"
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
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
