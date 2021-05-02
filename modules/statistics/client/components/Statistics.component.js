// External dependencies
import { Trans, useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Internal dependencies
import { get } from '../api/statistics.api';
import { getNetworkName } from '@/modules/users/client/utils/networks';
import Board from '@/modules/core/client/components/Board';
import Stat from './Stat';
import Tooltip from '@/modules/core/client/components/Tooltip';

const Grid = styled.div`
  align-items: stretch;
  display: grid;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));

  @media (min-width: 481px) {
    grid-gap: 10px;

    .is-graph {
      grid-column: span 2;
    }
  }
`;

const CountPlaceholder = styled.div`
  content: '  ';
  display: inline-block;
  min-width: 20px;
  height: 20px;
  background: #eee;
`;

const Count = styled.p`
  font-size: 50px;
  line-height: 55px;
  color: #12b591;
  font-weight: 300;
`;

export default function Statistics({ isAuthenticated }) {
  const { t } = useTranslation('statistics');
  const [statistics, setStatistics] = useState(false);

  const numberFormat = number =>
    number ? new Intl.NumberFormat().format(number) : 0;

  useEffect(async () => {
    const { data } = await get();
    setStatistics(data);
  }, []);

  return (
    <>
      <Board names="nordiclights">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 text-center">
              <br />
              <br />
              <h2>{t('Trustroots Statistics')}</h2>
              <br />
              <p className="lead">
                {/* Dec 23, 2014 */}
                {t(
                  'Enabling the latent trust between humans since {{date, LL}}',
                  { date: new Date(2014, 11, 23) },
                )}
              </p>
            </div>
          </div>
        </div>
      </Board>

      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12">
            <Grid>
              <Stat title={t('Members')}>
                {!statistics ? (
                  <CountPlaceholder />
                ) : (
                  <Count>{numberFormat(statistics?.total)}</Count>
                )}
              </Stat>

              <Stat title={t('Member growth')} className="is-graph">
                <a href="https://grafana.trustroots.org/d/000000002/members">
                  <img
                    className="img-responsive"
                    src="https://grafana.trustroots.org/render/d-solo/000000002/members?orgId=1&theme=light&panelId=1&width=800&height=400&tz=UTC"
                    width="100%"
                    alt={t('Member growth')}
                  />
                </a>
              </Stat>

              <Stat title={t('Hosts')}>
                {!statistics ? (
                  <>
                    <CountPlaceholder />
                    <CountPlaceholder />
                    <CountPlaceholder />
                  </>
                ) : (
                  <>
                    <Tooltip
                      id="hosts-tooltip"
                      tooltip={t('{{count}} members', {
                        count: numberFormat(statistics?.hosting?.total ?? 0),
                      })}
                    >
                      <Count>{`${statistics?.hosting?.percentage}%`}</Count>
                    </Tooltip>
                    <Tooltip
                      id="hosts-yes-tooltip"
                      tooltip={t('{{count}} members', {
                        count: numberFormat(statistics?.hosting?.yes ?? 0),
                      })}
                      placement="bottom"
                    >
                      <p className="text-muted">
                        {t('{{percentage}}% yes', {
                          percentage: statistics?.hosting?.yesPercentage ?? 0,
                        })}
                      </p>
                    </Tooltip>
                    <Tooltip
                      id="hosts-maybe-tooltip"
                      tooltip={t('{{count}} members', {
                        count: statistics?.hosting?.maybe ?? 0,
                      })}
                      placement="bottom"
                    >
                      <p className="text-muted">
                        {t('{{percentage}}% maybe', {
                          percentage: statistics?.hosting?.maybePercentage ?? 0,
                        })}
                      </p>
                    </Tooltip>
                  </>
                )}
              </Stat>

              <Stat title={t('Member retention')} className="is-graph">
                <a href="https://grafana.trustroots.org/d/UCqv_IYiz/member-retention">
                  <img
                    className="img-responsive"
                    src="https://grafana.trustroots.org/render/d-solo/UCqv_IYiz/member-retention?orgId=1&theme=light&panelId=4&width=800&height=400&tz=UTC"
                    width="100%"
                    alt={t('Member retention')}
                  />
                </a>
              </Stat>

              <Stat title={t('Connected to networks')}>
                <ul className="list-unstyled text-right">
                  {!statistics
                    ? Array(6).map(i => (
                        <li key={i}>
                          <CountPlaceholder />
                        </li>
                      ))
                    : statistics?.connections?.map(
                        ({ network, count, percentage }) => (
                          <Tooltip
                            id={`network-${network}-tooltip`}
                            key={network}
                            placement="right"
                            tooltip={t('{{count}} members', {
                              count: numberFormat(count),
                            })}
                          >
                            <li>
                              {`${getNetworkName(network)} ${percentage}%`}
                            </li>
                          </Tooltip>
                        ),
                      )}
                </ul>
              </Stat>

              <Stat title={t('Newsletter')}>
                {!statistics ? (
                  <>
                    <CountPlaceholder />
                    <CountPlaceholder />
                  </>
                ) : (
                  <>
                    <Count>{statistics?.newsletter?.percentage ?? 0}%</Count>
                    <p className="text-muted">
                      {t('{{count}} subscribers', {
                        count: statistics?.newsletter?.count ?? 0,
                      })}
                    </p>
                    {isAuthenticated && (
                      <p>
                        <a
                          className="btn btn-sm btn-default"
                          href="/profile/edit/account"
                        >
                          {t('Subscribe to newsletter')}
                        </a>
                      </p>
                    )}
                  </>
                )}
              </Stat>

              <Stat title={t('Most messages get replies')} className="is-graph">
                <a href="https://grafana.trustroots.org/d/000000004/messages-detailed">
                  <img
                    className="img-responsive"
                    src="https://grafana.trustroots.org/render/d-solo/000000004/messages-detailed?orgId=1&theme=light&panelId=4&width=800&height=400&tz=UTC"
                    width="100%"
                    alt={t('Weekly messages')}
                  />
                </a>
              </Stat>

              <Stat title={t('Translations status')} className="is-graph">
                <a href="https://hosted.weblate.org/engage/trustroots/">
                  <img
                    alt={t('Translations status')}
                    src="https://hosted.weblate.org/widgets/trustroots/-/horizontal-auto.svg"
                  />
                </a>
              </Stat>
            </Grid>

            <hr />

            <p className="lead">
              <Trans t={t} ns="statistics">
                Check <a href="https://grafana.trustroots.org/">our Grafana</a>{' '}
                for stats galore.
              </Trans>
            </p>

            <p className="lead">
              {t('Wanna help understand Trustroots more in depth?')}{' '}
              <a href="/volunteering">{t('Consider volunteering!')}</a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

Statistics.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};
