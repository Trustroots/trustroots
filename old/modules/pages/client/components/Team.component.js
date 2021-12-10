// External dependencies
import { Trans, useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import { getVolunteers } from '../api/volunteers.api';
import { userType } from '@/modules/users/client/users.prop-types';
import Board from '@/modules/core/client/components/Board.js';
import ManifestoText from './ManifestoText.component.js';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

export default function Team({ user }) {
  const { t } = useTranslation('pages');
  const [isFetching, setIsFetching] = useState(false);
  const [volunteers, setVolunteers] = useState([]);
  const [alumni, setAlumni] = useState([]);

  async function fetchVolunteers() {
    setIsFetching(true);
    try {
      const { volunteers, alumni } = await getVolunteers();
      setVolunteers(volunteers);
      setAlumni(alumni);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchVolunteers();
  }, []);

  return (
    <>
      <section className="container container-spacer">
        {/* Intro */}
        <div className="row">
          <div className="col-xs-12 col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4 text-center">
            <img
              alt="Trustroots"
              className="hidden-xs"
              height="120"
              src="/img/tree-color.svg"
              width="120"
            />
            <br />
            <br />
            <h1>{t('Trustroots Team')}</h1>
            <br />
            <p className="lead">
              <em>
                {t(
                  '“If you want to go fast, go alone. If you want to go far, go together.”',
                )}
              </em>
            </p>
            <small className="text-muted">{t('African proverb')}</small>
            <hr />
          </div>
        </div>

        <div className="row">
          <div className="col-xs-12">
            {isFetching && <LoadingIndicator />}
            {volunteers.length > 0 && (
              <div className="team-volunteers">
                {volunteers.map(({ _id, username, firstName }) => (
                  <div className="team-volunteer" key={_id}>
                    <a href={`/profile/${username}`}>
                      <img
                        alt={firstName || username}
                        className="img-circle"
                        src={
                          user
                            ? `/api/users/${_id}/avatar?size=256`
                            : '/img/avatar.png'
                        }
                      />
                      <h4>{firstName || username}</h4>
                    </a>
                  </div>
                ))}
              </div>
            )}
            <p className="text-center">
              <Trans t={t} ns="pages">
                <a href="/support">Contact us</a> if you have any questions.
              </Trans>
            </p>
          </div>
        </div>
        <hr />
        <div className="row">
          <div className="col-xs-12 text-center">
            <h2>{t('Help us build Trustroots!')}</h2>
            <p className="lead">
              <em>
                <br />
                {t('Nobody can do everything, but everyone can do something.')}
              </em>
            </p>
            <p>
              <a
                className="btn btn-lg btn-primary"
                href="https://team.trustroots.org/Volunteering.html"
              >
                {t('Get active!')}
              </a>
              <br />
              <br />
            </p>
          </div>
        </div>
        <hr />
        <div className="row">
          <div className="col-xs-12 text-center">
            <h4>
              {t(
                'Thank you to everyone who has helped Trustroots over the years!',
              )}
            </h4>
            {alumni.length > 0 && (
              <ul className="list-inline">
                {alumni.map(({ _id, username, firstName }) => (
                  <li key={_id}>
                    <a href={`/profile/${username}`}>{firstName || username}</a>
                  </li>
                ))}
              </ul>
            )}
            <br />
            <br />
          </div>
        </div>
      </section>

      <Board
        className="board-primary board-inset"
        names="jungleroad"
        id="manifesto"
      >
        <div className="container">
          <div className="row">
            <div className="col-md-offset-3 col-md-6 text-center lead font-brand-light">
              <ManifestoText></ManifestoText>
              {!user && (
                <p>
                  <br />
                  <br />
                  <a
                    href="/signup"
                    className="btn btn-lg btn-action btn-inverse"
                  >
                    {t('Join Trustroots')}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 text-center">
            <p className="text-muted">{t('Follow Trustroots')}</p>
            <div className="btn-group">
              <a
                href="https://ideas.trustroots.org/"
                className="btn btn-link btn-lg"
              >
                {t('Blog')}
              </a>
              <a
                href="https://www.facebook.com/trustroots.org"
                className="btn btn-link btn-lg"
              >
                {t('Facebook page')}
              </a>
              <a
                href="https://www.facebook.com/groups/trustroots/"
                className="btn btn-link btn-lg"
              >
                {t('Facebook group')}
              </a>
              <a
                href="https://www.instagram.com/trustroots/"
                className="btn btn-link btn-lg"
              >
                Instagram
              </a>
              <a
                href="https://twitter.com/trustroots"
                className="btn btn-link btn-lg"
              >
                Twitter
              </a>
            </div>
            <br />
            <br />
          </div>
        </div>
      </section>
    </>
  );
}

Team.propTypes = {
  user: userType,
};
