import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { useTranslation } from 'react-i18next';

export default function Guide() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board className="guide-header" names="happyhippies">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Trustroots Guide')}</h2>
              <h3>{t('For Writing Great Messages')}</h3>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <h3>{t('Make sure your profile is complete')}</h3>
            <p className="lead">
              {t(
                "You're much more likely to get a positive response if you have written a bit about yourself.",
              )}
            </p>

            <p>
              {t(
                "Make sure your own profile is complete. You're much more likely to get a positive response if you have written a bit about yourself. Absolute bare minimum: links to profiles elsewhere.",
              )}
            </p>
            <p>
              {t(
                'A good profile picture can definitely help you get responses from many people.',
              )}
            </p>

            <br />

            <h3>{t('Explain to them why you are choosing them')}</h3>
            <p className="lead">
              {t(
                '...explaining that you are interested in meeting them, not just looking for free accommodation.',
              )}
            </p>
            <p>
              {t(
                "Read their profiles. If someone is vegan you don't want to tell them how you want to try Currywurst (unless it's vegan Currywurst of course). You also want to look for things in common, e.g. you both hitchhiked through Syria (and survived).",
              )}
            </p>

            <br />

            <h3>{t("Tell your host why you're on a trip")}</h3>
            <p className="lead">
              {t(
                'What are your expectations in regards with going through their town?',
              )}
            </p>
            <p>
              {t(
                'Write a little bit about yourself in the message. No essay though.',
              )}
            </p>

            <br />

            <h3>{t('Trustroots is very much about spontaneous travel')}</h3>
            <p className="lead">{t("Don't write to people 2 months ahead.")}</p>

            <br />

            <p>
              <a href="/profile/edit" className="btn btn-lg btn-default">
                {t('Fill your profile')}
              </a>
              <a href="/search" className="btn btn-lg btn-default">
                {t('Find members')}
              </a>
            </p>

            <h3>{t('More information')}</h3>

            <ul>
              <li>
                <a
                  href="https://wiki.trustroots.org/en/How_to_write_a_hosting_request"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('Trustroots Wiki: how to write a hosting request')}
                </a>
              </li>
              <li>
                <a
                  href="https://www.bewelcome.org/wiki/Writing_your_host"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('BeWelcome: Writing to your host')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Guide.propTypes = {};
