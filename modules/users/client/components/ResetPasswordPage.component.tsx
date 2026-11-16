import React, { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import { Input } from '@trustroots/ui/Input';

import {
  passwordResetFailureReason,
  useAnalytics,
} from '@trustroots/analytics/client';
import Board from '@/modules/core/client/components/Board';
import useDesktopAutofocus from '@/modules/core/client/hooks/use-desktop-autofocus';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';
import { readApiError } from '../utils/api-error';
import { Alert } from '@trustroots/ui/Alert';

export default function ResetPasswordPage() {
  const { track } = useAnalytics();
  const passwordInput = useDesktopAutofocus<HTMLInputElement>();
  const { token } = useParams({ strict: false });
  const navigate = useNavigate();
  const { setUser } = useAuth() as {
    setUser: (user: { _id: string; username: string; email?: string }) => void;
  };
  const [passwordDetails, setPasswordDetails] = useState({
    newPassword: '',
    verifyPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    if (passwordDetails.newPassword !== passwordDetails.verifyPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const user = await authApi.resetPassword(token, passwordDetails);

      if (!('mfaRequired' in user)) setUser(user);
      track('password_reset_completed');
      void navigate({ to: '/password/reset/success' });
    } catch (requestError: unknown) {
      track('password_reset_failed', {
        reason: passwordResetFailureReason(requestError),
      });
      setError(
        readApiError(requestError).message ||
          'We could not confirm whether your password was changed. Try signing in with your new password before requesting another reset.',
      );
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
        <h3 className="tw:grid-col-12 text-center">Reset your password</h3>
        <div className="tw:grid-offset-1 tw:grid-col-10 tw:sm:grid-offset-4 tw:sm:grid-col-4 tw:md:grid-offset-5 tw:md:grid-col-2">
          <br />
          <form
            className="form-horizontal tw:mb-5 tw:[&_[data-slot=input]]:border-0 tw:[&_[data-slot=input]]:shadow-[0_0_10px_#0000001a] tw:[&_[data-slot=input]:focus]:shadow-[0_0_10px_#0000001a]"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <fieldset>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <Input
                  ref={passwordInput}
                  type="password"
                  required
                  id="newPassword"
                  name="newPassword"
                  fieldSize="lg"
                  placeholder="New Password"
                  minLength={8}
                  value={passwordDetails.newPassword}
                  onChange={event => {
                    const { value } = event.target;

                    setPasswordDetails(current => ({
                      ...current,
                      newPassword: value,
                    }));
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="verifyPassword">Verify Password</label>
                <Input
                  type="password"
                  required
                  id="verifyPassword"
                  name="verifyPassword"
                  fieldSize="lg"
                  placeholder="Verify Password"
                  minLength={8}
                  value={passwordDetails.verifyPassword}
                  onChange={event => {
                    const { value } = event.target;

                    setPasswordDetails(current => ({
                      ...current,
                      verifyPassword: value,
                    }));
                  }}
                />
              </div>
              <div className="text-center form-group">
                <Button
                  size="lg"
                  type="submit"
                  disabled={
                    isLoading ||
                    passwordDetails.newPassword.length < 8 ||
                    passwordDetails.verifyPassword.length < 8
                  }
                >
                  Update Password
                </Button>
              </div>
              {error && (
                <Alert className="tw:text-center" intent="danger" role="alert">
                  <strong>{error}</strong>
                </Alert>
              )}
            </fieldset>
          </form>
        </div>
      </div>
    </Board>
  );
}
