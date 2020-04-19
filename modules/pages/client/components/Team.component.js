import React from 'react';
import Tooltip from '@/modules/core/client/components/Tooltip.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Team() {
  const { t } = useTranslation('pages');

  return (
    <section className="container container-spacer">
      {/* Intro */}
      <div className="row">
        <div className="col-xs-12 col-sm-6 col-sm-offset-3 col-md-4 col-md-offset-4 text-center">
          <img
            className="hidden-xs"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
          />
          <br />
          <br />
          <h1>{t('Trustroots Teams')}</h1>
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

      {/* Volunteers */}
      <div className="row text-center" id="volunteering">
        <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3">
          <br />
          <br />
          <h2>{t('Volunteering')}</h2>
          <br />
          <br />
          <p>
            <em className="lead">
              {t('Help us build Trustroots!')}
              <br />
              {t('Nobody can do everything, but everyone can do something.')}
            </em>
          </p>
          <p>
            <a href="https://team.trustroots.org/Volunteering.html">
              {t('Get active!')}
            </a>
          </p>
        </div>
      </div>

      <hr />

      {/* Board */}
      <div className="row">
        <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3 text-center">
          <h2 id="board">{t('Board')}</h2>
          <h5>
            <a href="/foundation" className="text-uppercase">
              {t('Trustroots Foundation')}
            </a>
          </h5>
          <p>
            <Trans t={t} ns="pages">
              We are a group of hospitality exchange enthusiasts with
              backgrounds in some notable projects. The same people who also
              brought you <a href="http://hitchwiki.org/">Hitchwiki</a>,{' '}
              <a href="http://trashwiki.org/">Trashwiki</a>,{' '}
              <a href="http://nomadwihki.org/">Nomadwiki</a> &amp; more.
            </Trans>
          </p>
          <p>
            {t(
              'All current board members are also members of the founding team. We will have non-founding members in the board at some point.',
            )}
          </p>
          <br />
          <br />
        </div>
      </div>
      <div className="row">
        <div className="col-xs-12 col-sm-4">
          {/* Mikael */}
          <div className="media">
            <a className="pull-left" href="http://www.mikaelkorpela.fi/">
              <img
                className="media-object img-circle"
                src="//gravatar.com/avatar/d0229f23745d3c266f81c6b0cd014a38?s=200"
                width="100"
                alt="Mikael"
              />
            </a>
            <div className="media-body">
              <h4 className="media-heading">Mikael</h4>
              <p className="text-color-links">
                <Trans t={t} ns="pages">
                  Working on big freegan/travel projects such as{' '}
                  <a href="http://hitchwiki.org/">Hitchwiki</a>,{' '}
                  <a href="http://hitchgathering.org/">
                    Hitchgathering festival
                  </a>
                  , <a href="http://trashwiki.org/">Trashwiki</a> and{' '}
                  <a href="http://nomadwiki.org/">Nomadwiki</a> since 2008. In
                  the past has volunteered for BeWelcome (2013). Active open
                  source contributor and visionary free/gift-economics activist.
                  A developer at{' '}
                  <a href="https://automattic.com/">Automattic</a>.
                </Trans>
              </p>
              <p>
                <a href="https://www.mikaelkorpela.fi/" className="text-muted">
                  mikaelkorpela.fi
                </a>{' '}
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/mikael">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="twitter-tooltip"
                  tooltip="Twitter"
                  placement="bottom"
                >
                  <a href="https://twitter.com/simison">
                    <i className="text-muted icon-fw icon-lg icon-twitter"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="github-tooltip"
                  tooltip="GitHub"
                  placement="bottom"
                >
                  <a href="https://github.com/simison">
                    <i className="text-muted icon-fw icon-lg icon-github"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="linkedin-tooltip"
                  tooltip="LinkedIn"
                  placement="bottom"
                >
                  <a href="https://www.linkedin.com/in/mikaelkorpela">
                    <i className="text-muted icon-fw icon-lg icon-linkedin"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
          <br />
          <br />
        </div>
        <div className="col-xs-12 col-sm-4">
          {/* Natalia */}
          <div className="media">
            <img
              className="media-object img-circle pull-left"
              src="/img/team-natalia.jpg"
              width="100"
              alt="Natalia"
            />
            <div className="media-body">
              <h4 className="media-heading">Natalia</h4>
              <p className="text-color-links">
                {t(
                  'Coming from a multinational business background, Natalia is an enthusiastic of the share and gift economy. Veteran globetrotter and volunteer for different NGOs from hospex as Couchsurfing to nonprofit lobbying orgs.',
                )}
              </p>
              <p>
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/natalia_sevilla">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="linkedin-tooltip"
                  tooltip="LinkedIn"
                  placement="bottom"
                >
                  <a href="https://www.linkedin.com/in/natalia-s%C3%A1enz-alban%C3%A9s-38469227/">
                    <i className="text-muted icon-fw icon-lg icon-linkedin"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
        </div>
        <div className="col-xs-12 col-sm-4">
          {/* Kasper */}
          <div className="media">
            <a className="pull-left" href="https://guaka.org/">
              <img
                className="media-object img-circle"
                src="//gravatar.com/avatar/edccc1f234833b3b5c266c18c2db139d?s=200"
                width="100"
                alt="Kasper"
              />
            </a>
            <div className="media-body">
              <h4 className="media-heading">Kasper</h4>
              <p className="text-color-links">
                <Trans t={t} ns="pages">
                  Founded multiple popular and trusted websites such as{' '}
                  <a href="http://hitchwiki.org/">Hitchwiki</a>,{' '}
                  <a href="http://trashwiki.org/">Trashwiki</a>,{' '}
                  <a href="http://nomadwiki.org/">Nomadwiki</a>,{' '}
                  <a href="http://couchwiki.org/">Couchwiki</a> and{' '}
                  <a href="http://deletionpedia.org/">Deletionpedia</a>.{' '}
                  Volunteered for CouchSurfing as a tech team coordinator in
                  2006 and 2007 and for{' '}
                  <a href="https://www.bewelcome.org/">BeWelcome</a> since 2007.
                  Loves paradoxes, makes money with{' '}
                  <a href="https://moneyless.org/">moneyless.org</a>.
                </Trans>
              </p>
              <p>
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/guaka">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="github-tooltip"
                  tooltip="GitHub"
                  placement="bottom"
                >
                  <a href="https://github.com/guaka">
                    <i className="text-muted icon-fw icon-lg icon-github"></i>{' '}
                  </a>
                </Tooltip>
                <a href="https://guaka.org/" className="text-muted">
                  guaka.org
                </a>{' '}
              </p>
            </div>
          </div>
        </div>
      </div>

      <hr />

      {/* Support team */}
      <div className="row" id="support-team">
        <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3 text-center">
          <h2 id="board">{t('Support team')}</h2>
          <br />
          <br />
        </div>
      </div>
      <div className="row">
        <div className="col-xs-12 col-sm-4 col-sm-offset-2">
          {/* Noah */}
          <div className="media">
            <img
              className="media-object img-circle pull-left"
              src="/img/team-noah.jpg"
              width="100"
              alt="Noah"
            />
            <div className="media-body">
              <h4 className="media-heading">Noah</h4>
              <p className="text-color-links">
                {t(
                  'Focussed on community building. Technical know-how in various fields. Likes to create safe spaces everywhere around the world, digital and analog ones.',
                )}
              </p>
              <p>
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/noah_my_noah">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
        </div>
        <div className="col-xs-12 col-sm-4">
          {/* Dario */}
          <div className="media">
            <img
              className="media-object img-circle pull-left"
              src="/img/team-dario.jpg"
              width="100"
              alt="Dario"
            />
            <div className="media-body">
              <h4 className="media-heading">Dario</h4>
              <p className="text-color-links">
                {t(
                  'Likes to contribute to projects empowering people, putting them in control of their own resources. Currently reeducating himself to work as a software developer.',
                )}
              </p>
              <p>
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/rumwerfer">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
        </div>
      </div>

      <hr />

      <div className="row">
        <div className="col-xs-12 col-sm-8 col-sm-offset-2 col-md-6 col-md-offset-3 text-center">
          <h2>{t('Initial Co-Founders')}</h2>
          <p>{t('Callum and Carlos were also part of the founding team.')}</p>
          <br />
          <br />
        </div>
      </div>

      <div className="row">
        <div className="col-xs-12 col-sm-4 col-sm-offset-2">
          {/* Callum */}
          <div className="media">
            <a className="pull-left" href="https://www.callum-macdonald.com/">
              <img
                className="media-object img-circle"
                src="//gravatar.com/avatar/1e2eebc68bae7e891391688ad1c331d1?s=100"
                width="100"
                alt=""
              />
            </a>
            <div className="media-body">
              <h4 className="media-heading">Callum</h4>
              <p className="text-color-links">
                {t(
                  'Long term nomad and technology expert. Volunteered for BeWelcome BoD in 2013 and for CouchSurfing in 2007.',
                )}
              </p>
              <p>
                <a
                  href="https://www.callum-macdonald.com/"
                  className="text-muted"
                >
                  callum-macdonald.com
                </a>{' '}
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/chmac">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="twitter-tooltip"
                  tooltip="Twitter"
                  placement="bottom"
                >
                  <a href="https://twitter.com/chmac">
                    <i className="text-muted icon-fw icon-lg icon-twitter"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="github-tooltip"
                  tooltip="GitHub"
                  placement="bottom"
                >
                  <a href="https://github.com/chmac">
                    <i className="text-muted icon-fw icon-lg icon-github"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="linkedin-tooltip"
                  tooltip="LinkedIn"
                  placement="bottom"
                >
                  <a href="https://www.linkedin.com/in/chmac">
                    <i className="text-muted icon-fw icon-lg icon-linkedin"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
        </div>
        <div className="col-xs-12 col-sm-4">
          {/* Carlos */}
          <div className="media">
            <img
              className="media-object img-circle pull-left"
              src="/img/team-carlos.jpg"
              width="100"
              alt="Carlos"
            />
            <div className="media-body">
              <h4 className="media-heading">Carlos</h4>
              <p className="text-color-links">
                {t(
                  'Love to travel, passionate and enthusiastic about share economy and hospitality exchange as human development tools. Volunteered CouchSurfing from 2008 to 2010 as well as other NGOs.',
                )}
              </p>
              <p>
                <Tooltip
                  id="trustroot-tooltip"
                  tooltip="Trustroots"
                  placement="bottom"
                >
                  <a href="/profile/carlos">
                    <i className="text-muted icon-fw icon-lg icon-tree"></i>{' '}
                  </a>
                </Tooltip>
                <Tooltip
                  id="linkedin-tooltip"
                  tooltip="LinkedIn"
                  placement="bottom"
                >
                  <a href="https://www.linkedin.com/in/carlosmcardenas/">
                    <i className="text-muted icon-fw icon-lg icon-linkedin"></i>{' '}
                  </a>
                </Tooltip>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-xs-12 text-center">
          <hr />
          <a
            className="btn btn-xs btn-primary pull-right"
            href="https://github.com/Trustroots/trustroots/edit/master/modules/pages/client/views/team.client.view.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('Edit this page')}
            <i className="icon-github icon-lg"></i>
          </a>
          <br />
          <br />
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
  );
}

Team.propTypes = {};
