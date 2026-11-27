import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';
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
      .catch(reason => {
        if (active) {
          setError(
            readApiError(reason).message ||
              'Could not load authenticator settings.',
          );
        }
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
          <div className="tw:mb-5 tw:grid tw:max-w-lg tw:gap-3 tw:rounded-md tw:border tw:border-solid tw:border-neutral-300 tw:p-4">
            <p>These recovery codes are shown once. Store them safely.</p>
            <ul
              aria-label="Recovery codes"
              className="tw:grid tw:list-none tw:gap-2 tw:pl-0 tw:sm:grid-cols-2"
            >
              {recoveryCodes.map(recoveryCode => (
                <li key={recoveryCode}>
                  <code>{recoveryCode}</code>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              intent="neutral"
              className="tw:self-start"
              onClick={() => setRecoveryCodes([])}
            >
              I have saved these codes
            </Button>
          </div>
        )}
        {!status ? (
          !error && <p>Loading authenticator settings...</p>
        ) : status.enabled ? (
          <>
            <p>
              Recovery codes: <strong>{status.recoveryCodesRemaining}</strong>
            </p>
            <form
              className="tw:flex tw:w-full tw:max-w-lg tw:flex-col tw:gap-4"
              onSubmit={handleRecoveryCodes}
              autoComplete="off"
            >
              <div className="tw:flex tw:flex-col tw:gap-1">
                <label htmlFor="mfa-current-password">Current password</label>
                <Input
                  id="mfa-current-password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1">
                <label htmlFor="mfa-manage-code">
                  Authenticator or recovery code
                </label>
                <Input
                  id="mfa-manage-code"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                intent="neutral"
                className="tw:self-start"
                disabled={busy}
              >
                Replace recovery codes
              </Button>
            </form>
            <hr />
            <form
              className="tw:flex tw:w-full tw:max-w-lg tw:flex-col tw:gap-4"
              onSubmit={handleDisable}
              autoComplete="off"
            >
              <div className="tw:flex tw:flex-col tw:gap-1">
                <label htmlFor="mfa-disable-password">
                  Confirm your password
                </label>
                <Input
                  id="mfa-disable-password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="tw:flex tw:flex-col tw:gap-1">
                <label htmlFor="mfa-disable-code">
                  Authenticator or recovery code
                </label>
                <Input
                  id="mfa-disable-code"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                intent="danger"
                className="tw:self-start"
                disabled={busy}
              >
                Disable authenticator MFA
              </Button>
            </form>
          </>
        ) : setup ? (
          <>
            <p>Enter this setup link in your authenticator app:</p>
            <p>
              <code className="tw:wrap-anywhere">{setup.provisioningUri}</code>
            </p>
            <p>
              This setup expires at{' '}
              {new Date(setup.expires).toLocaleTimeString()}.
            </p>
            <form
              className="tw:flex tw:w-full tw:max-w-lg tw:flex-col tw:gap-4"
              onSubmit={handleVerifyEnrollment}
              autoComplete="off"
            >
              <div className="tw:flex tw:flex-col tw:gap-1">
                <label htmlFor="mfa-enrol-code">
                  Current authenticator code
                </label>
                <Input
                  id="mfa-enrol-code"
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                intent="primary"
                className="tw:self-start"
                disabled={busy}
              >
                Enable authenticator MFA
              </Button>
            </form>
          </>
        ) : (
          <form
            className="tw:flex tw:w-full tw:max-w-lg tw:flex-col tw:gap-4"
            onSubmit={handleBegin}
            autoComplete="off"
          >
            <p>
              Add an authenticator app to protect sign-in and privileged account
              access.
            </p>
            <div className="tw:flex tw:flex-col tw:gap-1">
              <label htmlFor="mfa-enrol-password">Confirm your password</label>
              <Input
                id="mfa-enrol-password"
                type="password"
                required
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              intent="primary"
              className="tw:self-start"
              disabled={busy}
            >
              Set up authenticator
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
