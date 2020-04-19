import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function DonateHelp() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Donation help')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-8 col-md-9">
            <h3>{t('Is this site secure?')}</h3>
            <p>
              {t(
                'All information is encrypted and handled following the highest standard of data protection. This and donation sites are transfered trough secured https connections.',
              )}
            </p>

            {/*
            <h3>Why did my credit/debit card donation get rejected?</h3>
            <p>...</p>

            <h3>Why did my PayPal donation get rejected?</h3>
            <p>...</p>
            */}

            <h3>
              {t(
                "Why don't I see my currency or country on the donation form?",
              )}
            </h3>
            <p>
              <Trans t={t} ns="pages">
                In addition to Euros and Bitcoins, we accept donations in{' '}
                <a href="https://www.paypal.com/multicurrency">
                  currencies accepted by PayPal
                </a>
                .
              </Trans>
            </p>

            <h3>{t('Are Bitcoin transfers secure?')}</h3>
            <p>
              <Trans t={t} ns="pages">
                We are probably setting up &quot;
                <a href="https://bitcoinmagazine.com/11108/multisig-future-bitcoin/">
                  multisig wallet
                </a>
                &quot; so there will not be a single point of failure.
              </Trans>
            </p>

            <h3>
              {t('I got an email from you asking to donate, is it legit?')}
            </h3>
            <p>
              <Trans t={t} ns="pages">
                We might&apos;ve indeed send you an email. However, links on
                that email should always direct to our{' '}
                <a href="/donate">page</a>, not directly to paypal or other
                money transfer sites. Contact us if you are uncertain.
              </Trans>
            </p>
            <p>
              {t(
                'We will never send you bank account, bitcoin address or other such things directly to your email.',
              )}
            </p>
            <p>
              {t('Neither we will never ask for your password via emails.')}
            </p>

            <h3>{t('Still having trouble?')}</h3>
            <p>
              <Trans t={t} ns="pages">
                For questions about Trustroots Foundation and the website, see
                our <a href="/faq">FAQ</a>.
              </Trans>
            </p>

            <p>
              <Trans t={t} ns="pages">
                <a href="/support">Contact us</a> if you have any further
                questions!
              </Trans>
            </p>

            <p>
              <br />
              <a href="/donate" className="btn btn-lg btn-primary">
                <i className="icon-heart-alt"></i> {t('Support Trustroots')}
              </a>
              <br />
            </p>
          </div>

          <div className="col-xs-12 col-sm-4 col-md-3">
            <div className="sidebar">
              <div className="panel panel-default">
                <div className="panel-body">
                  <div className="list-group">
                    <a href="/donate" className="list-group-item">
                      {t('Donate')}
                    </a>
                    <a href="/donate/help" className="list-group-item active">
                      {t('Donation help')}
                    </a>
                    <a href="/donate/policy" className="list-group-item">
                      {t('Donor policy')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            {/* .sidebar */}
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

DonateHelp.propTypes = {};
