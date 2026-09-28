// External dependencies
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Trans, useTranslation } from 'react-i18next';

// Internal dependencies
import { send } from '../api/support.api';
import usePersistentSupportMessage from '../hooks/use-persistent-support-message';
import { SUPPORT_CATEGORIES } from '../../shared/categories';

export default function SupportForm({ user }) {
  const { t } = useTranslation('support');
  // Keep literal keys discoverable by the translation extractor.
  const categoryLabels = {
    account: t('Account help'),
    reportMember: t('Report a member'),
    volunteering: t('Volunteering'),
    other: t('Other'),
  };
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingFailed, setSendingFailed] = useState(false);
  const [reportMember, setReportMember] = useState('');
  const [category, setCategory] = useState('other');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [supportMessage, setSupportMessage] = usePersistentSupportMessage('');

  const onSubmit = async event => {
    event.preventDefault();
    setIsSending(true);
    try {
      await send({
        category,
        email,
        message: supportMessage,
        reportMember: category === 'reportMember' ? reportMember : '',
        username,
      });
      setSupportMessage(''); // Clear out message from browser cache
      setIsSent(true);
    } catch {
      setSendingFailed(true);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    try {
      const url = new URL(document.location).searchParams;
      const username = url.get('report');
      if (username) {
        setReportMember(username);
        setCategory('reportMember');
      } else {
        const requestedCategory = url.get('category');
        if (
          Object.prototype.hasOwnProperty.call(
            SUPPORT_CATEGORIES,
            requestedCategory,
          )
        ) {
          setCategory(requestedCategory);
        }
      }
    } catch {
      // Backup in parsing errors, just grab the whole URL part
      setReportMember(document.location.search);
      if (document.location.search) {
        setCategory('reportMember');
      }
    }
  }, []);

  if (isSent) {
    return (
      <>
        <p className="lead">
          <em>
            {t('Thanks for getting in touch!')}
            <br />
            <br />
            {t(
              'Your message has been sent to the Trustroots team. We’re a small team of volunteers, so a reply may take a little time. We appreciate your patience.',
            )}
          </em>
        </p>
        <p>
          <br />
          <br />
          <Trans t={t} ns="support">
            Return to <a href="/">home</a> or browse our{' '}
            <a href="/faq">frequently asked questions</a>.
          </Trans>
        </p>
      </>
    );
  }

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4>
          {category === 'reportMember'
            ? t('Report member to support')
            : t('Contact us')}
        </h4>
      </div>
      <div className="panel-body">
        {sendingFailed && (
          <div className="alert alert-danger" role="alert">
            <strong>{t('Something went wrong sending your message.')}</strong>
            <br />
            {t('Please ensure you are connected to internet and try again.')}
          </div>
        )}
        <form
          name="supportForm"
          onSubmit={onSubmit}
          noValidate
          autoComplete="off"
          className="form-horizontal"
        >
          <div className="form-group">
            <label htmlFor="category" className="col-sm-2 control-label">
              {t('What can we help with?')}
            </label>
            <div className="col-sm-10">
              <select
                id="category"
                className="form-control input-lg"
                value={category}
                disabled={isSending}
                onChange={event => setCategory(event.target.value)}
              >
                {Object.keys(SUPPORT_CATEGORIES).map(value => (
                  <option key={value} value={value}>
                    {categoryLabels[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Reporting another profile */}
          {category === 'reportMember' && (
            <div className="form-group">
              <label className="col-sm-2 control-label">
                {t('Reported member')}
              </label>
              <div className="col-sm-10">
                {reportMember ? (
                  <p className="form-control-static">
                    <strong>{reportMember}</strong>
                  </p>
                ) : (
                  <p className="help-block">
                    {t('Please include the member’s username in your message.')}
                  </p>
                )}
                <p className="form-control-static">
                  <em>
                    {t(
                      'This message goes to Trustroots support, not to the member.',
                    )}
                  </em>
                </p>
                <p className="form-control-static">
                  <em>
                    {t(
                      'If you or someone you know have witnessed or been a victim of a crime, please report it to the police immediately.',
                    )}
                  </em>
                </p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="message" className="col-sm-2 control-label">
              {t('Message')}
            </label>
            <div className="col-sm-10">
              <textarea
                className="form-control input-lg"
                rows="7"
                id="message"
                required
                aria-describedby="message-help"
                disabled={isSending}
                defaultValue={supportMessage}
                onChange={event => {
                  setSupportMessage(event.target.value);
                }}
              ></textarea>
              <span className="help-block" id="message-help">
                {category === 'volunteering' && (
                  <>
                    {t(
                      'Briefly tell us about your interests, skills, and availability.',
                    )}
                    <br />
                  </>
                )}
                {t(
                  'Our support team speaks several languages. Write in whichever language you prefer — English is helpful when you can.',
                )}
                <br />
              </span>
            </div>
          </div>

          {/* Name is sent only for logged in users, don't bother to ask it from non-logged users */}
          {user?.displayName && (
            <div className="form-group">
              <label className="col-sm-2 control-label">{t('Name')}</label>
              <div className="col-sm-10">
                <p className="form-control-static">{user.displayName}</p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="col-sm-2 control-label">
              {t('Username')}
            </label>
            <div className="col-sm-10">
              {user?.username ? (
                <p className="form-control-static">{user.username}</p>
              ) : (
                <input
                  type="text"
                  className="form-control input-lg"
                  id="username"
                  onChange={event => {
                    setUsername(event.target.value);
                  }}
                  disabled={isSending}
                />
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="col-sm-2 control-label">
              {t('Email')}
            </label>
            <div className="col-sm-10">
              {user?.email ? (
                <p className="form-control-static">{user.email}</p>
              ) : (
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-control input-lg"
                  disabled={isSending}
                  onChange={event => {
                    setEmail(event.target.value);
                  }}
                />
              )}
            </div>
          </div>

          <div className="form-group">
            <div className="col-sm-offset-2 col-sm-10">
              <button
                type="submit"
                className="btn btn-lg btn-primary"
                disabled={isSending || supportMessage?.trim()?.length === 0}
              >
                {isSending ? t('Wait…') : t('Send')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

SupportForm.propTypes = {
  user: PropTypes.object,
};
