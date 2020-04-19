import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Donate() {
  const { t } = useTranslation('pages');

  return (
    <>
      <Board names="forestpath">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <i className="icon-3x icon-heart-alt"></i>
              <br />
              <br />
              <h2>{t('Support Trustroots')}</h2>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-6 col-md-offset-1 col-md-5">
            <p className="lead">
              <Trans t={t} ns="pages">
                Trustroots is run entirely by donations. We are a non-profit{' '}
                <a href="/foundation">foundation</a> registered in the United
                Kingdom in March 2015.
              </Trans>
            </p>

            <h4>{t('How will my donation be used?')}</h4>
            <p>
              {t(
                "Most our expenses are tech related; servers, services, domains and bandwidth. Additionally we have expenses from governing the foundation, such as legal consultation, handling our finances and accounting. In the future we consider paying salaries to get some of the work done. This said, we're mainly a volunteer organisation and that won't change. We are working on opening up our expenditures and governance soon.",
              )}
            </p>
            <br />

            <h4>{t('Is my donation tax deductible?')}</h4>
            <p>{t('Unfortunately not at the moment.')}</p>
            <br />

            <h4>{t('Which currencies do you accept?')}</h4>
            <p>
              {t(
                'You can donate via PayPal, which currently accepts nearly two dozen currencies.',
              )}
            </p>
            <br />

            <h4>{t('Can I donate bitcoin?')}</h4>
            <p>{t('Yes!')}</p>
            <br />

            <h4>
              {t(
                'I’m unable to give money at this time, are there other ways I can help?',
              )}
            </h4>
            <p>
              <Trans t={t} ns="pages">
                Yes! <a href="/volunteering">Become a volunteer</a> and make a
                difference.
              </Trans>
            </p>

            <hr />

            <p>
              <a href="/donate/help">{t('Problems donating?')}</a>
            </p>

            <br />
          </div>
          <div className="col-xs-12 col-sm-6 col-md-5">
            <p className="lead">
              <em>
                {t(
                  "We're currently working on setting up ways to receive donations. Until that, this page gives you preliminary information about our funding model.",
                )}
              </em>
            </p>
            <hr />
            <h2>{t('Ways to Give')}</h2>
            <h3>{t('Credit/debit card')}</h3>
            {t(
              "We don't have a credit card transfer set up yet at this point.",
            )}
            <h3>{t('Bank transfer')}</h3>
            {t("We don't have a bank account set up yet at this point.")}
            <h3>Bitcoin</h3>
            <Trans t={t} ns="pages">
              <a href="/support">Contact us</a> if you want to donate through
              Bitcoin.
            </Trans>
            <h3>PayPal</h3>
            <Trans t={t} ns="pages">
              <a href="/support">Contact us</a> if you want to donate through
              PayPal.
            </Trans>
            <h3>{t('Referal programs')}</h3>
            <h4>{t('Namecheap')}</h4>
            <Trans t={t} ns="pages">
              We use and recommend Namecheap for domains, partly because
              they&apos;re a{' '}
              <a href="https://www.namecheap.com/about/causes.aspx">
                responsible company
              </a>{' '}
              and foremost they do a great job. Sign up via{' '}
              <a href="https://www.namecheap.com/?aff=90636">this link</a> and
              we&apos;ll get little bit in return.
            </Trans>
            <br />
            <h4>DigitalOcean</h4>
            <Trans t={t} ns="pages">
              Our servers are hosted at reliable and easy to use DigitalOcean.
              Sign up via{' '}
              <a href="https://www.digitalocean.com/?refcode=6dc078966c9c">
                this link
              </a>{' '}
              and when you start using their VPS service, we get 25$ to cover
              our hosting, you get 10$.
            </Trans>
            <hr />
            <p>
              <small>
                <Trans t={t} ns="pages">
                  By donating, you agree to share your personal information with
                  the Trustroots Foundation, the non-profit organisation running
                  Trustroots.org, pursuant to our{' '}
                  <a href="/donate/policy">donor policy</a>. Trustroots
                  Foundation is located in the United Kingdom. We do not sell or
                  trade your information to anyone.
                </Trans>
              </small>
            </p>
          </div>
          <a
            className="btn btn-xs btn-primary pull-right"
            href="https://github.com/Trustroots/trustroots/edit/master/modules/pages/client/views/donate.client.view.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('Edit this page')}
            <i className="icon-github icon-lg"></i>
          </a>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Donate.propTypes = {};
