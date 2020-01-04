import React, { Component } from 'react';
import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';
import '@/config/client/i18n';
import PropTypes from 'prop-types';
import { limitTo, plainTextLength } from '@/modules/core/client/utils/filters';

export class AboutMe extends Component {
  constructor(props) {
    super(props);
    this.changeProfileDescriptionToggle = this.changeProfileDescriptionToggle.bind(this);

    this.state = {
      profileDescriptionToggle: false,
    };
  }
  changeProfileDescriptionToggle(){
    this.setState((prevState) => ({
      profileDescriptionToggle: !prevState.profileDescriptionToggle,
    }));
  }

  render(){
    const { t, profile, isSelf, appSettings } = this.props;
    return (<>
      <section className="panel panel-default">
        <header className="panel-heading">
          {t('About me')}
        </header>
        <div className="panel-body">
          {/* Short descriptions */}
          {(profile.description.length < 2400 || this.state.profileDescriptionToggle) &&
          <div dangerouslySetInnerHTML={{ __html: profile.description }}></div>}

          {/* Long descriptions */}
          {profile.description.length >= 2400 && !this.state.profileDescriptionToggle &&
          <div
            className="panel-more-wrap">
            <div className="panel-more-excerpt" dangerouslySetInnerHTML={{ __html: limitTo(profile.description, 2400) }}></div>
            <div className="panel-more-fade" onClick={this.changeProfileDescriptionToggle}>{t('Show more...')}</div>
          </div>}

          {/* If no description, show deep thoughts... */}
          {(!profile.description || profile.description === '') &&
          <blockquote className="profile-quote"
            aria-label={t('Member has not written description about themself.')}>
          “Everyone is necessarily the hero of their own life story.”
          </blockquote>}
        </div>

        {/* User watching their own profile and it's too short */}
        {(isSelf && (!profile.description || plainTextLength(profile.description) < appSettings.profileMinimumLength)) &&
        <footer className="panel-footer">
          <p className="lead">
            {t('Your profile description should be longer so that you can send messages.')}
            <br/><br />
            <a href="/profile/edit" className="btn btn-primary">{t('Fill your profile')}</a>
          </p>
        </footer>}
      </section>
    </>);
  }
}

AboutMe.propTypes = {
  profile: PropTypes.object,
  isSelf: PropTypes.bool,
  appSettings: PropTypes.object,
  t: PropTypes.func,
};

export default withTranslation(['user-profile'])(AboutMe);
