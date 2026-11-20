import React, { useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';

import { useAnalytics } from '@trustroots/analytics/client';
import Board from '@/modules/core/client/components/Board';
import useDesktopAutofocus from '@/modules/core/client/hooks/use-desktop-autofocus';
import * as authApi from '@/modules/users/client/api/auth.api';
import { readApiError } from '../utils/api-error';
import { Alert } from '@trustroots/ui/Alert';

export default function ForgotPasswordPage() {
  const { track } = useAnalytics();
  const usernameInput = useDesktopAutofocus<HTMLInputElement>();
  const { userhandle } = useSearch({ strict: false });
  const [credentials, setCredentials] = useState({
    username: userhandle || '',
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.forgotPassword(credentials);
      setCredentials({ username: '' });
      setSuccess(response.message);
      track('password_reset_requested');
    } catch (requestError: unknown) {
      setError(
        readApiError(requestError).message ||
          'We could not confirm whether the recovery request completed. Check your inbox before trying again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Board
      names="bokeh"
      className="tw:page-container container-spacer container-fullscreen"
    >
      <div className="tw:grid-row">
        <div className="tw:grid-col-12 text-center">
          <img
            className="tw:max-sm:hidden"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
            aria-hidden="true"
          />
          <img
            className="tw:inline-block tw:sm:hidden"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="80"
            height="80"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="tw:grid-row">
        <h3 className="tw:grid-col-12 text-center">Restore your password</h3>
        <div className="tw:grid-offset-1 tw:grid-col-10 tw:sm:grid-offset-4 tw:sm:grid-col-4 tw:md:grid-offset-5 tw:md:grid-col-2">
          <br />
          <form
            className="tw:mb-5 tw:[&_[data-slot=input]]:border-0 tw:[&_[data-slot=input]]:shadow-[0_0_10px_#0000001a] tw:[&_[data-slot=input]:focus]:shadow-[0_0_10px_#0000001a] form-horizontal"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <fieldset>
              <div className="form-group text-center">
                <label htmlFor="username">Email or username</label>
                <Input
                  ref={usernameInput}
                  type="text"
                  required
                  id="username"
                  name="username"
                  fieldSize="lg"
                  value={credentials.username}
                  disabled={isLoading}
                  onChange={event =>
                    setCredentials({ username: event.target.value })
                  }
                />
              </div>
              <div className="text-center form-group">
                <Button
                  size="lg"
                  type="submit"
                  disabled={isLoading || !credentials.username}
                >
                  {isLoading ? 'Wait...' : 'Restore'}
                </Button>
              </div>
              {error && (
                <Alert className="tw:text-center" intent="danger" role="alert">
                  <strong>{error}</strong>
                </Alert>
              )}
              {success && (
                <Alert className="tw:text-center" intent="success" role="alert">
                  <p>
                    <strong>
                      If an account matches that username or email, we will send
                      recovery instructions.
                    </strong>
                  </p>
                  <p>
                    If you don&apos;t see this email in your inbox within 15
                    minutes, look for it in your junk mail folder. If you find
                    it there, please mark it as &quot;Not Junk&quot;.
                  </p>
                </Alert>
              )}
            </fieldset>
          </form>
        </div>
      </div>
    </Board>
  );
}
