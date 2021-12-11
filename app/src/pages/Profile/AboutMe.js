// External dependencies
import PropTypes from 'prop-types';
import React from 'react';

// Internal dependencies
import { plainTextLength } from '../../utils/filters';
import ReadMorePanel from '../../components/ReadMorePanel';

export default function AboutMe({ profile, isSelf, profileMinimumLength }) {
  console.log(profile);
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
