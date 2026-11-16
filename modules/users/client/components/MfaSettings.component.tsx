import React, { useEffect, useState } from 'react';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as mfaApi from '../api/mfa.api';
import { readApiError } from '../utils/api-error';

export default function MfaSettings({
  onSignedOut = () => window.location.assign('/signin'),
}: {
  onSignedOut?: () => void;
}) {
  const { setUser } = useAuth();
  const [status, setStatus] = useState<mfaApi.MfaStatus | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<mfaApi.MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    mfaApi
      .getMfaStatus()
      .then(result => {
        if (active) setStatus(result);
      })
      .catch(() => {
        if (active) setError('Could not load authenticator settings.');
      });
    return () => {
      active = false;
    };
  }, []);

  function showError(reason: unknown) {
    setError(readApiError(reason).message || 'Something went wrong.');
    setMessage('');
  }

  async function handleBegin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSetup(await mfaApi.beginMfaEnrollment(currentPassword));
      setMessage(
        'Add this authenticator to your app, then enter its current code.',
      );
      setCurrentPassword('');
    } catch (reason: unknown) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEnrollment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await mfaApi.verifyMfaEnrollment(code);
      setStatus({
        enabled: true,
        recoveryCodesRemaining: result.recoveryCodes.length,
      });
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode('');
      setMessage(
        'Authenticator MFA is enabled. Save these recovery codes somewhere safe.',
      );
      setUser(previous => ({ ...previous, ...result.user }));
    } catch (reason: unknown) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoveryCodes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await mfaApi.regenerateMfaRecoveryCodes(
        currentPassword,
        code,
      );
      setRecoveryCodes(result.recoveryCodes);
      setStatus({
        enabled: true,
        recoveryCodesRemaining: result.recoveryCodes.length,
      });
      setCurrentPassword('');
      setCode('');
      setMessage(
        'New recovery codes created. Previous codes are no longer valid.',
      );
    } catch (reason: unknown) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await mfaApi.disableMfa(currentPassword, code);
      setUser(null);
      onSignedOut();
    } catch (reason: unknown) {
      showError(reason);
      setBusy(false);
    }
  }

  return (
    <section
      className="panel panel-default"
      aria-labelledby="mfa-settings-title"
    >
      <div className="panel-heading" id="mfa-settings-title">
        Authenticator MFA
      </div>
      <div className="panel-body">
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {recoveryCodes.length > 0 && (
          <div className="alert alert-warning">
            <p>These recovery codes are shown once. Store them safely.</p>
            <ul aria-label="Recovery codes">
              {recoveryCodes.map(recoveryCode => (
                <li key={recoveryCode}>
                  <code>{recoveryCode}</code>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => setRecoveryCodes([])}
            >
              I have saved these codes
            </button>
          </div>
        )}
        {!status ? (
          <p>Loading authenticator settings...</p>
        ) : status.enabled ? (
          <>
            <p>
              Authenticator MFA is enabled. {status.recoveryCodesRemaining}{' '}
              recovery codes remain.
            </p>
            <form onSubmit={handleRecoveryCodes} autoComplete="off">
              <div className="form-group">
                <label htmlFor="mfa-current-password">Current password</label>
                <input
                  id="mfa-current-password"
                  className="form-control"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mfa-manage-code">
                  Authenticator or recovery code
                </label>
                <input
                  id="mfa-manage-code"
                  className="form-control"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-default" disabled={busy}>
                Replace recovery codes
              </button>
            </form>
            <hr />
            <form onSubmit={handleDisable} autoComplete="off">
              <div className="form-group">
                <label htmlFor="mfa-disable-password">
                  Confirm your password
                </label>
                <input
                  id="mfa-disable-password"
                  className="form-control"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mfa-disable-code">
                  Authenticator or recovery code
                </label>
                <input
                  id="mfa-disable-code"
                  className="form-control"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                Disable authenticator MFA
              </button>
            </form>
          </>
        ) : setup ? (
          <>
            <p>Enter this setup link in your authenticator app:</p>
            <p>
              <code className="text-break">{setup.provisioningUri}</code>
            </p>
            <p>
              This setup expires at{' '}
              {new Date(setup.expires).toLocaleTimeString()}.
            </p>
            <form onSubmit={handleVerifyEnrollment} autoComplete="off">
              <div className="form-group">
                <label htmlFor="mfa-enrol-code">
                  Current authenticator code
                </label>
                <input
                  id="mfa-enrol-code"
                  className="form-control"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Enable authenticator MFA
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleBegin} autoComplete="off">
            <p>
              Add an authenticator app to protect sign-in and privileged account
              access.
            </p>
            <div className="form-group">
              <label htmlFor="mfa-enrol-password">Confirm your password</label>
              <input
                id="mfa-enrol-password"
                className="form-control"
                type="password"
                required
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Set up authenticator
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
