import React from 'react';
import Board from '@/modules/core/client/components/Board.js';
import { Trans, useTranslation } from 'react-i18next';

export default function Contribute() {
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
          <div className="col-xs-12 col-sm-12 col-md-offset-2 col-md-8">
            <p className="lead">
              <Trans t={t} ns="pages">
                Trustroots is a non-profit <a href="/foundation">foundation</a>{' '}
                registered in the United Kingdom in{' '}
                <a href="https://ideas.trustroots.org/2015/03/10/announcing-trustroots-foundation/">
                  March 2015
                </a>
                . At the moment our costs are mainly for servers and other
                technical aspects, currently between €1000 and €2000 per year.
                As accepting donations would lead to higher total costs (due to
                accounting etc.) and require more effort than it seems worth,
                everything is currently being covered by the board.
              </Trans>
            </p>
            <p className="lead">
              <Trans t={t} ns="pages">
                That said, there are still other ways to support us!
              </Trans>
            </p>
            <hr />
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12  col-sm-6 col-md-offset-2 col-md-4">
            <h2>{t('Volunteering')}</h2>
            <p>
              <Trans t={t} ns="pages">
                Whether you’re a hardcore techie or know nothing of coding, we
                can use your help! See{' '}
                <a href="https://team.trustroots.org/Volunteering.html">
                  volunteer page
                </a>{' '}
                get an idea of what’s in the making and what you can do to help
                out. You could help Trustroots out with as little effort as
                donating your photo&apos;s to use for our website or create
                content. If you&apos;re a (semi-)professional photographer or
                have any questions you can <a href="/contact">contact us</a>.
              </Trans>
            </p>
          </div>
          <div className="col-xs-12 col-sm-6 col-md-4">
            <h2>{t('Referal Programs')}</h2>
            <p>
              <Trans t={t} ns="pages">
                We use and recommend <strong>Namecheap</strong> for domains,
                partly because they&apos;re a{' '}
                <a href="https://www.namecheap.com/about/causes.aspx">
                  responsible company
                </a>{' '}
                and foremost as they do a great job. Sign up via{' '}
                <a href="https://www.namecheap.com/?aff=90636">this link</a> and
                we&apos;ll get little bit in return.
              </Trans>
            </p>
            <p>
              <Trans t={t} ns="pages">
                Our servers are hosted at reliable and easy to use{' '}
                <strong>DigitalOcean</strong>. Sign up via{' '}
                <a href="https://www.digitalocean.com/?refcode=6dc078966c9c">
                  this link
                </a>{' '}
                and when you start using their VPS service, we get 25$ to cover
                our hosting, you get 100$.
              </Trans>
            </p>
          </div>
        </div>
      </section>
      {/* /.container */}
    </>
  );
}

Contribute.propTypes = {};
