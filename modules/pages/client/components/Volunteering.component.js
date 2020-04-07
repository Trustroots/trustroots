import React from 'react';
import { useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import { selectPhoto } from '@/modules/core/client/services/photos.service';

export default function Volunteering() {
  const { t } = useTranslation('pages');

  const photo = selectPhoto('happyhippies');

  return (
    <>
      <section
        className="board volunteer-header board-happyhippies"
        style={{ backgroundImage: `url("${photo.imageUrl}")` }}
      >
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <i className="icon-3x icon-heart-o"></i>
              <br />
              <br />
              <h2>{t('Volunteering')}</h2>
            </div>
          </div>
        </div>
        <div></div>
      </section>
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <p className="lead">
              {t(
                'Help us build Trustroots! Nobody can do everything, but everyone can do something…',
              )}
            </p>
            <p>
              {t(
                'Trustroots needs developers, designers, people handling support queue, copywriting and much more.',
              )}
            </p>
            <p>
              {t(
                'Please head over to our Team Guide to learn how to get started.',
              )}
            </p>
            <p>
              <a href="https://team.trustroots.org/">{t('Team Guide')}</a>
            </p>
          </div>
          <a
            className="btn btn-xs btn-primary pull-right"
            href="https://github.com/Trustroots/trustroots/edit/master/modules/pages/client/components/Volunteering.component.js"
            rel="noopener noreferrer"
            target="_blank"
          >
            Edit this page<i className="icon-github icon-lg"></i>
          </a>
        </div>
      </section>
    </>
  );
}

Volunteering.propTypes = {};
