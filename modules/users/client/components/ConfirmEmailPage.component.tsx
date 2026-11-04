import React, { useEffect, useState } from 'react';

import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import { Alert } from '@trustroots/ui/Alert';
import {
  emailConfirmFailureReason,
  useAnalytics,
} from '@trustroots/analytics/client';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';

export default function ConfirmEmailPage() {
  const { user, setUser } = useAuth() as {
    user: { email?: string } | null;
    setUser: (user: { _id: string; username: string; email?: string }) => void;
  };
  const { token } = useParams({ strict: false });
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const [details, setDetails] =
    useState<authApi.EmailConfirmationDetails | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelledEmail, setCancelledEmail] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState(false);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setError(false);
    setSuccess(false);
    setCancelledEmail(null);
    setCancelError(false);
    if (!token) {
      setError(true);
      return;
    }
    authApi.getEmailConfirmationDetails(token).then(
      result => {
        if (active) setDetails(result);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  async function handleConfirmEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || isCancelling) return;
    setIsLoading(true);
    try {
      const response = await authApi.confirmEmail(token);
      setUser(response.user);
      track('email_confirmed', {
        kind: response.profileMadePublic ? 'signup' : 'change',
      });
      if (response.profileMadePublic) {
        void navigate({ to: '/welcome' });
        return;
      }
      setSuccess(true);
    } catch (error: unknown) {
      track('email_confirm_failed', {
        reason: emailConfirmFailureReason(error),
      });
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelEmailChange() {
    setIsCancelling(true);
    setCancelError(false);
    try {
      const result = await authApi.cancelEmailChange(token);
      setCancelledEmail(result.currentEmail);
    } catch {
      setCancelError(true);
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <section className="container container-spacer email-confirmation">
      <div
        className="email-confirmation-card"
        aria-labelledby="email-confirmation-title"
      >
        <img
          src="/img/tree-color.svg"
          alt=""
          width="72"
          height="80"
          className="email-confirmation-tree"
        />
        <h1 id="email-confirmation-title">
          {cancelledEmail
            ? 'Email change cancelled'
            : success
              ? 'Email confirmed'
              : details?.signup
                ? 'Confirm your email'
                : 'Confirm your email change'}
        </h1>
        {cancelledEmail ? (
          <div role="status">
            <p>
              Your email change has been cancelled.{' '}
              <strong className="email-confirmation-address">
                {cancelledEmail}
              </strong>{' '}
              is still your active email address.
            </p>
            <p>The confirmation link can no longer be used.</p>
            <Button
              intent="primary"
              size="lg"
              className="tw:w-full"
              render={<a href="/profile/edit/account" />}
            >
              Back to account settings
            </Button>
          </div>
        ) : error ? (
          <Alert intent="danger" role="alert">
            <p>
              <strong>We could not confirm your email.</strong>
            </p>
            <p>
              The link may be invalid, expired or already used. If you just
              confirmed, your email may already be updated.
            </p>
            {user ? (
              <p>
                Check your email or request a new confirmation in{' '}
                <a href="/profile/edit/account">your settings</a>.
              </p>
            ) : (
              <p>
                <a href="/signin">Login first</a> to check your email or request
                a new confirmation.
              </p>
            )}
          </Alert>
        ) : success ? (
          <div role="status">
            <p className="email-confirmation-intro">
              Your email is now confirmed!
            </p>
            <p>
              You can now use{' '}
              <strong className="email-confirmation-address">
                {details!.newEmail}
              </strong>{' '}
              to sign in and receive Trustroots notifications.
            </p>
            <Button
              intent="primary"
              size="lg"
              className="tw:w-full"
              render={<a href="/profile/edit/account" />}
            >
              Back to account settings
            </Button>
          </div>
        ) : details ? (
          <form
            onSubmit={handleConfirmEmail}
            aria-busy={isLoading || isCancelling}
            aria-label="Email confirmation"
          >
            <p className="email-confirmation-intro">
              {details.signup
                ? 'One more step to join the community. Confirm your email to make your profile visible to other members.'
                : 'Please check the addresses below before updating your account.'}
            </p>
            <dl className="email-confirmation-addresses">
              {!details.signup && (
                <div>
                  <dt>Current email</dt>
                  <dd>{details.currentEmail}</dd>
                </div>
              )}
              <div className="email-confirmation-new">
                <dt>{details.signup ? 'Email address' : 'New email'}</dt>
                <dd>{details.newEmail}</dd>
              </div>
            </dl>
            <p>
              {details.signup
                ? 'This is where we will send your Trustroots notifications.'
                : 'Once confirmed, your new email will replace your current address for signing in and receiving Trustroots notifications.'}
            </p>
            <Button
              type="submit"
              intent="primary"
              size="lg"
              className="tw:w-full"
              disabled={isLoading || isCancelling}
            >
              {isLoading
                ? 'Confirming…'
                : details.signup
                  ? 'Confirm email'
                  : 'Confirm email change'}
            </Button>
            {!details.signup && (
              <Button
                type="button"
                className="tw:mt-3 tw:w-full"
                disabled={isLoading || isCancelling}
                onClick={handleCancelEmailChange}
              >
                {isCancelling ? 'Cancelling…' : 'Cancel email change'}
              </Button>
            )}
            {cancelError && (
              <Alert intent="danger" role="alert">
                Unable to cancel the email change. The link may have expired or
                the change may already be complete. Check your account settings
                or try again.
              </Alert>
            )}
            {!details.signup && (
              <p className="email-confirmation-help">
                Need a different address?{' '}
                <a href="/profile/edit/account">Go to account settings</a> to
                check your email address.
              </p>
            )}
          </form>
        ) : (
          <p role="status">Loading email details…</p>
        )}
      </div>
    </section>
  );
}
