import React from 'react';
import PropTypes from 'prop-types';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Faq({ category, children }) {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board className="faq-header" names={['happyhippies', 'guitarcamper']}>
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <h2 className="visible-xs-block">{t('FAQ')}</h2>
              <h2 className="hidden-xs">{t('Frequently Asked Questions')}</h2>
              {category === 'general' && (
                <h3>{t('about the site & community')}</h3>
              )}
              {category === 'tribes' && <h3>{t('about circles')}</h3>}
              {category === 'foundation' && (
                <h3>{t('about the foundation')}</h3>
              )}
              {category === 'technology' && <h3>{t('about technology')}</h3>}
            </div>
          </div>
        </div>
      </Board>

      <section className="container">
        <div className="row">
          <div className="col-xs-12 col-sm-4 col-md-4">
            <div id="faq-sidebar" className="sidebar">
              {/* <Site & Community */}
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h3 className="panel-title">
                    <a href="/faq" className="undecorated-link text-color">
                      {t('Site & community')}
                    </a>
                  </h3>
                </div>
                {category === 'general' && (
                  <div className="panel-body">
                    <div className="list-group">
                      <a
                        href="/faq#is-trustroots-exclusively-for-hitchhikers"
                        className="list-group-item"
                      >
                        {t('Is Trustroots exclusively for hitchhikers?')}
                      </a>
                      <a
                        href="/faq#what-is-your-long-term-vision"
                        className="list-group-item"
                      >
                        {t('What is your long term vision?')}
                      </a>
                      <a
                        href="/faq#is-trustroots-alternative"
                        className="list-group-item"
                      >
                        {t(
                          'Is Trustroots an alternative for CouchSurfing or BeWelcome?',
                        )}
                      </a>
                      <a
                        href="/faq#is-there-mobile-app"
                        className="list-group-item"
                      >
                        {t('Is there a mobile app?')}
                      </a>
                      <a
                        href="/faq#how-is-this-connected-to-hitchwiki-nomadwiki-or-trashwiki"
                        className="list-group-item"
                      >
                        {t(
                          'How is this connected to Hitchwiki, Nomadwiki or Trashwiki?',
                        )}
                      </a>
                      <a
                        href="/faq#why-the-name-trustroots"
                        className="list-group-item"
                      >
                        {t('Why the name Trustroots?')}
                      </a>
                      <a
                        href="/faq#why-is-there-facebook-connection"
                        className="list-group-item"
                      >
                        {t('Why is there Facebook connection?')}
                      </a>
                      <a
                        href="/faq#why-is-there-no-forum"
                        className="list-group-item"
                      >
                        {t('Why is there no forum?')}
                      </a>
                      <a
                        href="/faq#why-was-my-account-suspended"
                        className="list-group-item"
                      >
                        {t('Why was my account suspended?')}
                      </a>
                      <a
                        href="/faq#how-can-i-remove-my-account"
                        className="list-group-item"
                      >
                        {t('How can I remove my account?')}
                      </a>
                      <a href="/faq#how-can-i-help" className="list-group-item">
                        {t('How can I help?')}
                      </a>
                      <a
                        href="/faq#how-can-i-contact-you"
                        className="list-group-item"
                      >
                        {t('How can I contact you?')}
                      </a>
                      <a
                        href="/faq#how-do-i-report-a-member-that-violates-the-rules"
                        className="list-group-item"
                      >
                        {t('How do I report a member that violates the rules?')}
                      </a>
                      <a href="/faq#covid-19" className="list-group-item">
                        {t('Trustroots and COVID-19 outbreak')}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Foundation */}
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h3 className="panel-title">
                    <a
                      href="/faq/foundation"
                      className="undecorated-link text-color"
                    >
                      {t('Foundation')}
                    </a>
                  </h3>
                </div>
                {category === 'foundation' && (
                  <div className="panel-body">
                    <div className="list-group">
                      <a
                        href="/faq/foundation#what-is-your-legal-status"
                        className="list-group-item"
                      >
                        {t("What's your legal status?")}
                      </a>
                      <a
                        href="/faq/foundation#why-limited-by-guarantee"
                        className="list-group-item"
                      >
                        {t(
                          'Why Limited by Guarantee under section 60 exemption?',
                        )}
                      </a>
                      <a
                        href="/faq/foundation#are-you-going-to-sell-out"
                        className="list-group-item"
                      >
                        {t('Could Trustroots assets be sold?')}
                      </a>
                      <a
                        href="/faq/foundation#who-are-the-board"
                        className="list-group-item"
                      >
                        {t('Who are the board?')}
                      </a>
                      <a
                        href="/faq/foundation#how-do-you-want-to-make-the-project-financially-sustainable"
                        className="list-group-item"
                      >
                        {t(
                          'How do you want to make the project financially sustainable?',
                        )}
                      </a>
                      <a
                        href="/faq/foundation#who-decides-what-gets-done"
                        className="list-group-item"
                      >
                        {t('Who decides what gets done?')}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Circles */}
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h3 className="panel-title">
                    <a
                      href="/faq/circles"
                      className="undecorated-link text-color"
                    >
                      {t('Circles')}
                    </a>
                  </h3>
                </div>
                {category === 'circles' && (
                  <div className="panel-body">
                    <div className="list-group">
                      <a
                        href="/faq/circles#what-are-circles"
                        className="list-group-item"
                      >
                        {t('What are circles?')}
                      </a>
                      <a
                        href="/faq/circles#no-suitable-circles"
                        className="list-group-item"
                      >
                        {t("I don't find a circle that suits me")}
                      </a>
                      <a
                        href="/faq/circles#tribes-rename-to-circles"
                        className="list-group-item"
                      >
                        {t('Why did you rename "tribes" to "circles"?')}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Technology */}
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h3 className="panel-title">
                    <a
                      href="/faq/technology"
                      className="undecorated-link text-color"
                    >
                      {t('Technology')}
                    </a>
                  </h3>
                </div>
                {category === 'technology' && (
                  <div className="panel-body">
                    <div className="list-group">
                      <a
                        href="/faq/technology#opensource"
                        className="list-group-item"
                      >
                        {t('Is Trustroots open source?')}
                      </a>
                      <a
                        href="/faq/technology#im-a-developer"
                        className="list-group-item"
                      >
                        {t("I'm a developer and I want to help!")}
                      </a>
                      <a
                        href="/faq/technology#are-you-planning-to-do-x-feature"
                        className="list-group-item"
                      >
                        {t('Are you planning to do X feature?')}
                      </a>
                      <a
                        href="/faq/technology#statistics"
                        className="list-group-item"
                      >
                        {t('Do you have public statistics?')}
                      </a>
                      <a
                        href="/faq/technology#f-droid"
                        className="list-group-item"
                      >
                        {t('Could you offer mobile app at F-Droid store?')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* .sidebar */}
          </div>
          <div className="col-xs-12 col-sm-8 col-md-8">
            <div className="ui-view-slide-reveal">{children}</div>
            <br />
            <br />
            <hr />
            <p className="lead text-center" id="more-questions">
              {/* @TODO remove ns (issue #1368) */}
              <Trans t={t} ns="pages">
                More questions? <a href="/support">Ask us!</a> <br />
                <br />
                See also our <a href="https://ideas.trustroots.org/">
                  blog
                </a>{' '}
                and <a href="/">about</a> page.
              </Trans>
            </p>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Faq.propTypes = {
  category: PropTypes.string,
  children: PropTypes.node,
};
