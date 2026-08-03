import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ProfileEditPage from './ProfileEditPage.component';
import {
  changePassword,
  removeProfile,
  resendEmailConfirmation,
  update,
} from '../api/users.api';
import { useAuth } from '@/modules/core/client/react-app/auth';

export default function ProfileEditAccount({ user }) {
  const { t } = useTranslation('users');
  const { setUser } = useAuth();
  const [draftUser, setDraftUser] = useState({ ...user });
  const [emailMessage, setEmailMessage] = useState('');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [removalMessage, setRemovalMessage] = useState('');
  const [removeProfileConfirm, setRemoveProfileConfirm] = useState(false);
  const [isRemovingProfile, setIsRemovingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setEmailMessage('');

    try {
      const savedUser = await update({
        ...draftUser,
        username: undefined,
      });
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setEmailMessage(
        t(
          'We sent you an email to {{email}} with further instructions. Email change will not be active until that.',
          { email: savedUser.emailTemporary },
        ),
      );
    } catch (error) {
      setEmailMessage(
        error.response?.data?.message || t('Something went wrong.'),
      );
    }
  }

  async function handleUsernameSubmit(event) {
    event.preventDefault();
    setUsernameMessage('');

    try {
      const savedUser = await update({
        ...draftUser,
        email: undefined,
      });
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setUsernameMessage(t('Username updated.'));
    } catch (error) {
      setUsernameMessage(
        error.response?.data?.message || t('Something went wrong'),
      );
    }
  }

  async function handleSubscriptionsChange(field, value) {
    const nextUser = { ...draftUser, [field]: value };

    try {
      const savedUser = await update(nextUser);
      setUser(savedUser);
      setDraftUser({ ...savedUser });
    } catch (error) {
      setEmailMessage(
        error.response?.data?.message || t('Something went wrong.'),
      );
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage('');

    try {
      const { user: savedUser } = await changePassword({
        currentPassword,
        newPassword,
        verifyPassword,
      });
      setUser(savedUser);
      setDraftUser({ ...savedUser });
      setCurrentPassword('');
      setNewPassword('');
      setVerifyPassword('');
      setPasswordMessage(t('Your password is now changed. Have a nice day!'));
    } catch (error) {
      setPasswordMessage(
        error.response?.data?.message ||
          t('Password not changed due error, try again.'),
      );
    }
  }

  async function handleResendConfirmation(event) {
    event.preventDefault();

    try {
      await resendEmailConfirmation();
      setEmailMessage(t('Confirmation email resent.'));
    } catch (error) {
      setEmailMessage(
        error.response?.data?.message || t('Something went wrong.'),
      );
    }
  }

  async function handleRemoveProfile() {
    setIsRemovingProfile(true);

    try {
      const response = await removeProfile();
      setRemovalMessage(response.message || t('Success.'));
    } catch (error) {
      setRemovalMessage(
        error.response?.data?.message ||
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
                    onChange={event =>
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
                    className="form-control"
                    value={draftUser.username || ''}
                    onChange={event =>
                      setDraftUser(previous => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                  />
                  {usernameMessage && (
                    <p className="help-block">{usernameMessage}</p>
                  )}
                </div>
              </div>
              <div className="form-group">
                <div className="col-sm-push-3 col-sm-9">
                  <button type="submit" className="btn btn-primary">
                    {t('Change username')}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="panel panel-default">
        <div className="panel-heading">{t('News and updates')}</div>
        <div className="panel-body">
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={Boolean(draftUser.newsletter)}
                onChange={event =>
                  handleSubscriptionsChange('newsletter', event.target.checked)
                }
              />
              {t('Community newsletter')}
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
        <div className="panel-heading">{t('Remove profile')}</div>
        <div className="panel-body">
          <div className="checkbox">
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
            disabled={!removeProfileConfirm || isRemovingProfile}
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

ProfileEditAccount.propTypes = {
  user: PropTypes.object.isRequired,
};
