// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import ReadMorePanel from '@/modules/core/client/components/ReadMorePanel';

export default function AboutMe({ profile, isSelf, profileMinimumLength }) {
  return (
    <>
      <section className="panel panel-default">
        <header className="panel-heading">About me</header>
        <div className="panel-body">
          {profile.description && (
            <ReadMorePanel
              content={profile.description}
              id="profile-description"
            />
          )}

          {/* If no description, show deep thoughts... */}
          {!profile.description && (
            <blockquote
              aria-label="Member has not written description about themself."
              className="profile-quote"
            >
              {"&quot;Everyone is necessarily the hero of their own life
              story&quot;}
            </blockquote>
          )}
        </div>

        {/* User watching their own profile and it's too short */}
        {isSelf &&
          (!profile.description ||
            plainTextLength(profile.description) < profileMinimumLength) && (
            <footer className="panel-footer">
              <p className="lead">
                "Your profile description should be longer so that you can send
                messages."
                <br />
                <br />
                <a href="/profile/edit" className="btn btn-primary">
                  Fill your profile
                </a>
              </p>
            </footer>
          )}
      </section>
    </>
  );
}

AboutMe.propTypes = {
  profile: PropTypes.object,
  isSelf: PropTypes.bool,
  profileMinimumLength: PropTypes.number.isRequired,
};
