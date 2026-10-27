import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ProfileEditPage from './ProfileEditPage.component';
import {
  cancelProfileRemoval,
  getProfileRemovalStatus,
  changePassword,
  removeProfile,
  resendEmailConfirmation,
  update,
} from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';
import type { UserProfile } from '../types';
import { readApiError } from '../utils/api-error';
import {
  SIGNUP_USERNAME_REGEX,
  SIGNUP_USERNAME_FORMAT_MESSAGE,
} from '../config/username.client.constants';
import LanguageSwitch from '@/modules/core/client/components/LanguageSwitch';

interface ProfileEditAccountProps {
  user: UserProfile;
}

export default function ProfileEditAccount({ user }: ProfileEditAccountProps) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [emailMessage, setEmailMessage] = useState('');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [removalMessage, setRemovalMessage] = useState('');
  const [removalPending, setRemovalPending] = useState(false);
  const [isCheckingRemoval, setIsCheckingRemoval] = useState(true);
  const [isCancellingRemoval, setIsCancellingRemoval] = useState(false);
  const [removeProfileConfirm, setRemoveProfileConfirm] = useState(false);
  const [isRemovingProfile, setIsRemovingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const removalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait until the app shell has finished resetting the page scroll position.
    const frame = window.requestAnimationFrame(() => {
      if (window.location.hash === '#remove') {
        removalRef.current!.focus({ preventScroll: true });
        removalRef.current!.scrollIntoView({ block: 'start' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    getProfileRemovalStatus().then(
      status => {
        if (active) {
          setRemovalPending(status.pending);
          setIsCheckingRemoval(false);
        }
      },
      () => {
        if (active) {
          setIsCheckingRemoval(false);
          setRemovalMessage(
            t(
              'Could not check pending account deletion. Please reload to try again.',
            ),
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [t]);

  async function handleCancelRemoval() {
    setIsCancellingRemoval(true);
    setRemovalMessage('');
    try {
      await cancelProfileRemoval();
      setRemovalPending(false);
      setRemoveProfileConfirm(false);
      setIsRemovingProfile(false);
      setRemovalMessage(
        t('Account deletion cancelled. Your account will be kept.'),
      );
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setRemovalMessage(
        message || t('Could not cancel account deletion. Please try again.'),
      );
    } finally {
      setIsCancellingRemoval(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage('');

    try {
      const savedUser = await update({ email: draftUser.email });
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
      setEmailMessage(
        t(
          'We sent you an email to {{email}} with further instructions. Email change will not be active until that.',
          { email: savedUser.emailTemporary },
        ),
      );
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setEmailMessage(message || t('Something went wrong.'));
    }
  }

  async function handleUsernameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUsernameMessage('');
    const selectedUsername = (draftUser.username || '').trim();
    const username = selectedUsername.toLowerCase();
    if (
      username !== user.username &&
      !SIGNUP_USERNAME_REGEX.test(selectedUsername)
    ) {
      setUsernameMessage(t(SIGNUP_USERNAME_FORMAT_MESSAGE));
      return;
    }

    try {
      const savedUser = await update({ username: draftUser.username });
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
      setUsernameMessage(t('Username updated.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setUsernameMessage(message || t('Something went wrong'));
    }
  }

  async function handleSubscriptionsChange(
    field: 'newsletter',
    value: boolean,
  ) {
    try {
      const savedUser = await update({ newsletter: value });
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setEmailMessage(message || t('Something went wrong.'));
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage('');

    try {
      const { user: savedUser } = await changePassword({
        currentPassword,
        newPassword,
        verifyPassword,
      });
      setUser(current => ({ ...current, ...savedUser }));
      setDraftUser({ ...savedUser });
      setCurrentPassword('');
      setNewPassword('');
      setVerifyPassword('');
      setPasswordMessage(t('Your password is now changed. Have a nice day!'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setPasswordMessage(
        message || t('Password not changed due to an error, try again.'),
      );
    }
  }

  async function handleResendConfirmation(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();

    try {
      await resendEmailConfirmation();
      setEmailMessage(t('Confirmation email resent.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setEmailMessage(message || t('Something went wrong.'));
    }
  }

  async function handleRemoveProfile() {
    setIsRemovingProfile(true);

    try {
      const response = await removeProfile();
      setRemovalPending(true);
      setRemovalMessage(response.message || t('Success.'));
    } catch (error: unknown) {
      const { message } = readApiError(error);
      setRemovalMessage(
        message ||
          t(
            'Something went wrong while initializing profile removal, try again.',
          ),
      );
      setIsRemovingProfile(false);
    }
  }

  return (
    <ProfileEditPage user={user}>
      <div className="panel panel-default">
        <div className="panel-heading">{t('Email')}</div>
        <div className="panel-body">
          <form onSubmit={handleEmailSubmit} autoComplete="off">
            <div className="form-horizontal">
              <div className="form-group">
                <label
                  htmlFor="email"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Email Address')}
                </label>
                <div className="col-sm-9">
                  <input
                    type="email"
                    id="email"
                    className="form-control"
                    value={draftUser.email || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setDraftUser(previous => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                  />
                  {emailMessage && <p className="help-block">{emailMessage}</p>}
                </div>
              </div>
              <div className="form-group">
                <div className="col-sm-push-3 col-sm-9">
                  <button type="submit" className="btn btn-primary">
                    {t('Change email')}
                  </button>
                  {draftUser.emailTemporary && (
                    <button
                      type="button"
                      className="btn btn-default"
                      onClick={handleResendConfirmation}
                    >
                      {t('Resend confirmation')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="panel panel-default">
        <div className="panel-heading">{t('Username')}</div>
        <div className="panel-body">
          <form onSubmit={handleUsernameSubmit} autoComplete="off">
            <div className="form-horizontal">
              <div className="form-group">
                <label
                  htmlFor="username"
                  className="col-sm-3 text-right control-label"
                >
                  {t('Username')}
                </label>
                <div className="col-sm-9">
                  <input
                    type="text"
                    id="username"
                    disabled={draftUser.usernameUpdateAllowed === false}
                    className="form-control"
                    value={draftUser.username || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setDraftUser(previous => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                  />
                  <p className="help-block">
                    {t(
                      'You can change your username three months after joining, and again three months after each change.',
                    )}{' '}
                    {t(SIGNUP_USERNAME_FORMAT_MESSAGE)}{' '}
                    {t(
                      'Your current username can stay. A new username must also be available.',
                    )}
                  </p>
                  {usernameMessage && (
                    <p className="help-block">{usernameMessage}</p>
                  )}
                </div>
              </div>
              <div className="form-group">
                <div className="col-sm-push-3 col-sm-9">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={draftUser.usernameUpdateAllowed === false}
                  >
                    {t('Change username')}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="panel panel-default">
        <div className="panel-heading">{t('Interface language')}</div>
        <div className="panel-body">
          <p>
            {t(
              'This is the language of the interface you see across the site.',
            )}
          </p>
          <LanguageSwitch saveToAPI={true} />
        </div>
      </div>

      <div className="panel panel-default">
        <div className="panel-heading">{t('News and updates')}</div>
        <div className="panel-body">
          <div className="checkbox profile-newsletter">
            <label>
              <input
                type="checkbox"
                checked={Boolean(draftUser.newsletter)}
                onChange={event =>
                  handleSubscriptionsChange('newsletter', event.target.checked)
                }
              />
              <span>{t('Community newsletter')}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="panel panel-default" id="password">
        <div className="panel-heading">{t('Password')}</div>
        <div className="panel-body">
          <form onSubmit={handlePasswordSubmit} autoComplete="off">
            <div className="form-group">
              <label htmlFor="currentPassword">{t('Current password')}</label>
              <input
                type="password"
                id="currentPassword"
                className="form-control"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">{t('New password')}</label>
              <input
                type="password"
                id="newPassword"
                className="form-control"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="verifyPassword">{t('Verify password')}</label>
              <input
                type="password"
                id="verifyPassword"
                className="form-control"
                value={verifyPassword}
                onChange={event => setVerifyPassword(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              {t('Change password')}
            </button>
            {passwordMessage && <p className="help-block">{passwordMessage}</p>}
          </form>
        </div>
      </div>

      <div className="panel panel-default">
        <div className="panel-heading">{t('Your data')}</div>
        <div className="panel-body">
          <p>
            {t(
              'This downloads a JSON file of your profile, the circles you belong to, your contacts (including requests that are still waiting), your hosting and meet offers (including ones that have expired), and the messages and experiences you have written. The filename includes your username and the UTC time of the download, for example trustroots-data-username-20261014-0931.json.',
            )}
          </p>
          <p>
            {t(
              'It does not include your password, your profile photo file, or messages and experiences written by other members.',
            )}
          </p>
          <a className="btn btn-default" href="/api/users/export">
            {t('Download your data')}
          </a>
        </div>
      </div>

      <div
        className="panel panel-default profile-remove"
        id="remove"
        ref={removalRef}
        tabIndex={-1}
        role="region"
        aria-labelledby="remove-heading"
      >
        <div className="panel-heading" id="remove-heading">
          {t('Remove profile')}
        </div>
        <div className="panel-body">
          <p>
            {t(
              'Removing your profile permanently deletes your Trustroots account and cannot be undone. You will no longer be able to sign in with this account.',
            )}
          </p>
          <p>
            {t(
              'Tick the box below and select Remove profile to request a confirmation email. This does not delete your account yet. Open the link in the email within 24 hours, then select Permanently delete my account to complete the removal.',
            )}
          </p>
          <p>
            {t(
              'You can download your data above before removing your account.',
            )}{' '}
            <a href="/faq#how-can-i-remove-my-account">
              {t('Read the account removal FAQ')}
            </a>
          </p>
          {removalPending && (
            <div className="alert alert-info" role="status">
              <p>
                {t(
                  'Account deletion is pending. You can cancel it here to invalidate the confirmation link in your email.',
                )}
              </p>
              <button
                type="button"
                className="btn btn-default"
                disabled={isCancellingRemoval}
                onClick={handleCancelRemoval}
              >
                {t('Cancel account deletion')}
              </button>
            </div>
          )}
          <div className="checkbox profile-remove-confirmation">
            <label>
              <input
                type="checkbox"
                checked={removeProfileConfirm}
                onChange={event =>
                  setRemoveProfileConfirm(event.target.checked)
                }
              />
              {t('Yes, I want to remove my profile')}
            </label>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            disabled={
              isCheckingRemoval ||
              !removeProfileConfirm ||
              isRemovingProfile ||
              removalPending ||
              isCancellingRemoval
            }
            onClick={removeProfileConfirm ? handleRemoveProfile : undefined}
          >
            {t('Remove profile')}
          </button>
          {removalMessage && <p className="help-block">{removalMessage}</p>}
        </div>
      </div>
    </ProfileEditPage>
  );
}
