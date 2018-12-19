import React from 'react';
import { NamespacesConsumer } from 'react-i18next';
import '@/config/lib/i18n';
import PropTypes from 'prop-types';
import { limitTo, plainTextLength } from './utils/filters';

export default function AboutMe({ profile, profileDescriptionToggle, user, appSettings }) {
  return (<NamespacesConsumer ns={['user-profile']}>{ (t) => (<>
    <section className="panel panel-default">
      <header className="panel-heading">
        {t('About me')}
      </header>
      <div className="panel-body">
        {/* Short descriptions */}
        {(profile.description.length < 2400 || profileDescriptionToggle) &&
        <div dangerouslySetInnerHTML={{ __html: profile.description }} ></div>}{/* TODO Can we trust this HTML?*/}

        {/* Long descriptions */}
        {profile.description.length >= 2400 && !profileDescriptionToggle &&
        <div
          className="panel-more-wrap" ng-click="profileCtrl.profileDescriptionToggle=true">
          <div className="panel-more-excerpt" setInnerHTML={limitTo(profile.description, 2400)}> </div>
          <div className="panel-more-fade">{t('Show more...')}</div>
        </div>}

        {/* If no description, show deep thoughts... */}
        {(!profile.description || profile.description === '') &&
        <blockquote className="profile-quote"
          aria-label={t('Member has not written description about themself.')}>
        “Everyone is necessarily the hero of their own life story.”
        </blockquote>}
      </div>

      {/* User watching their own profile and it's too short */}
      {(user._id === profile._id && (!profile.description || plainTextLength(profile.description) < appSettings.profileMinimumLength)) &&
      <footer className="panel-footer">
        <p className="lead">
          {t('Your profile description should be longer so that you can send messages.')}
          <br/><br />
          <a href="/profile/edit" className="btn btn-primary">{t('Fill your profile')}</a>
        </p>
      </footer>}
    </section>
  </>) }</NamespacesConsumer>);
};

AboutMe.propTypes = {
  profile: PropTypes.object,
  profileDescriptionToggle: PropTypes.bool,
  user: PropTypes.object,
  appSettings: PropTypes.object
};