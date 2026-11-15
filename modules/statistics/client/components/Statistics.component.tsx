// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import './statistics.css';

// Internal dependencies
import { get, type StatisticsResponse } from '../api/statistics.api';
import { getSuggestion } from '@/modules/experiences/client/api/experiences.api';
import { getProfileExperiencesPath } from '@/modules/core/shared/navigation-links';
import { getNetworkName } from '@/modules/users/client/utils/networks';
import BoardImplementation from '@/modules/core/client/components/Board';
import Stat from './Stat';
import StatisticsCharts from './StatisticsCharts';
import { Tooltip } from '@trustroots/ui/Tooltip';
import { Button } from '@trustroots/ui/Button';

interface ExperienceSuggestion {
  displayName: string;
  username: string;
}

const Board = BoardImplementation as React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
  names?: string | string[];
  style?: React.CSSProperties | null;
}>;

const legacyNetworks = new Set(['couchsurfing', 'facebook', 'github']);

export default function Statistics({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const { t: rawT } = useTranslation('statistics');
  const t = rawT as unknown as (
    key: string,
    options?: Record<string, unknown>,
  ) => string;
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [experienceSuggestion, setExperienceSuggestion] =
    useState<ExperienceSuggestion | null>(null);

  const numberFormat = (number?: number) =>
    number ? new Intl.NumberFormat().format(number) : 0;
  const percentage = (positive?: number, negative?: number) => {
    const answered = (positive ?? 0) + (negative ?? 0);
    return answered ? Math.round(((positive ?? 0) / answered) * 100) : 0;
  };
  const experienceStatistics = statistics?.experiences ?? {};
  const recentExperienceStatistics = experienceStatistics.recent ?? {};
  const messageInteractionStatistics = statistics?.messageInteractions ?? {};
  const recentMessageInteractionStatistics =
    messageInteractionStatistics.recent ?? {};
  const recommendationPercentage = percentage(
    experienceStatistics.recommended,
    experienceStatistics.notRecommended,
  );
  const recentRecommendationPercentage = percentage(
    recentExperienceStatistics.recommended,
    recentExperienceStatistics.notRecommended,
  );
  const positiveFeedbackPercentage = percentage(
    messageInteractionStatistics.positive,
    messageInteractionStatistics.negative,
  );
  const recentPositiveFeedbackPercentage = percentage(
    recentMessageInteractionStatistics.positive,
    recentMessageInteractionStatistics.negative,
  );

  useEffect(() => {
    const loadStatistics = async () => {
      const loadSuggestion =
        getSuggestion as unknown as () => Promise<ExperienceSuggestion | null>;
      const [{ data }, suggestion] = await Promise.all([
        get(),
        isAuthenticated ? loadSuggestion().catch(() => null) : null,
      ]);
      setStatistics(data);
      setExperienceSuggestion(suggestion);
    };

    loadStatistics();
  }, [isAuthenticated]);

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
            <div className="statistics-grid">
              <Stat title={t('Real-life connections')} className="is-graph">
                {!statistics ? (
                  <div className="statistics-count-placeholder" />
                ) : (
                  <>
                    <div className="statistics-period-group">
                      <p className="statistics-count">
                        {numberFormat(
                          experienceStatistics.realLifeConnections?.total ?? 0,
                        )}
                      </p>
                      <p className="text-muted">
                        {t(
                          'This is a lower bound: most people do not share an experience, and Trustroots did not have this experience feature until 2021.',
                        )}
                      </p>
                      {isAuthenticated && (
                        <p className="text-muted">
                          {experienceSuggestion ? (
                            <>
                              {t('Help make this picture more complete:')}{' '}
                              <a
                                href={getProfileExperiencesPath(
                                  experienceSuggestion.username,
                                )}
                              >
                                {t(
                                  'Why not write some nice words about {{contactName}}?',
                                  {
                                    contactName:
                                      experienceSuggestion.displayName,
                                  },
                                )}
                              </a>
                            </>
                          ) : (
                            t(
                              "Help make this picture more complete by sharing an experience from a member's profile.",
                            )
                          )}
                        </p>
                      )}
                      <p className="text-muted">
                        {t('{{percentage}}% recommended overall', {
                          percentage: recommendationPercentage,
                        })}
                      </p>
                    </div>
                    <div className="statistics-period-group">
                      <p className="text-muted">
                        {t('{{count}} in the last 90 days', {
                          count: numberFormat(
                            experienceStatistics.realLifeConnections?.recent ??
                              0,
                          ),
                        })}
                      </p>
                      <p className="text-muted">
                        {t('{{percentage}}% recommended in the last 90 days', {
                          percentage: recentRecommendationPercentage,
                        })}
                      </p>
                    </div>
                  </>
                )}
              </Stat>

              <Stat title={t('Message interactions')} className="is-graph">
                {!statistics ? (
                  <div className="statistics-count-placeholder" />
                ) : (
                  <>
                    <div className="statistics-period-group">
                      <p className="statistics-count">
                        {numberFormat(messageInteractionStatistics.total)}
                      </p>
                      <p className="text-muted">
                        {t(
                          'Interactions where both members exchanged messages',
                        )}
                      </p>
                      <p className="text-muted">
                        {t('{{percentage}}% positive feedback overall', {
                          percentage: positiveFeedbackPercentage,
                        })}
                      </p>
                    </div>
                    <div className="statistics-period-group">
                      <p className="text-muted">
                        {t('{{count}} in the last 90 days', {
                          count: numberFormat(
                            recentMessageInteractionStatistics.total,
                          ),
                        })}
                      </p>
                      <p className="text-muted">
                        {t(
                          '{{percentage}}% positive feedback in the last 90 days',
                          { percentage: recentPositiveFeedbackPercentage },
                        )}
                      </p>
                    </div>
                  </>
                )}
              </Stat>

              <Stat title={t('Members')}>
                {!statistics ? (
                  <div className="statistics-count-placeholder" />
                ) : (
                  <>
                    <p className="statistics-count">
                      {numberFormat(statistics?.total)}
                    </p>
                    <div className="statistics-signup-summary">
                      <p className="text-muted">
                        {t(
                          '{{count}} new signups in the past 7 days (168 hours)',
                          {
                            count: numberFormat(
                              statistics.recentActivity?.signups?.past7Days ??
                                0,
                            ),
                          },
                        )}
                      </p>
                      <p className="text-muted">
                        {t('{{count}} new signups in the past 24 hours', {
                          count: numberFormat(
                            statistics.recentActivity?.signups?.past24Hours ??
                              0,
                          ),
                        })}
                      </p>
                    </div>
                  </>
                )}
              </Stat>

              <Stat title={t('Recent activity')} className="is-graph">
                <table className="statistics-activity-table">
                  <caption className="sr-only">{t('Recent activity')}</caption>
                  <thead>
                    <tr>
                      <th scope="col" />
                      <th scope="col">{t('Past 7 days (168 hours)')}</th>
                      <th scope="col">{t('Past 24 hours')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">{t('New threads')}</th>
                      <td>
                        {statistics ? (
                          numberFormat(
                            statistics.recentActivity?.threads?.past7Days ?? 0,
                          )
                        ) : (
                          <div
                            className="statistics-count-placeholder"
                            role="status"
                            aria-label={t('Loading statistics')}
                          />
                        )}
                      </td>
                      <td>
                        {statistics ? (
                          numberFormat(
                            statistics.recentActivity?.threads?.past24Hours ??
                              0,
                          )
                        ) : (
                          <div
                            className="statistics-count-placeholder"
                            role="status"
                            aria-label={t('Loading statistics')}
                          />
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">{t('Messages sent')}</th>
                      <td>
                        {statistics ? (
                          numberFormat(
                            statistics.recentActivity?.messages?.past7Days ?? 0,
                          )
                        ) : (
                          <div
                            className="statistics-count-placeholder"
                            role="status"
                            aria-label={t('Loading statistics')}
                          />
                        )}
                      </td>
                      <td>
                        {statistics ? (
                          numberFormat(
                            statistics.recentActivity?.messages?.past24Hours ??
                              0,
                          )
                        ) : (
                          <div
                            className="statistics-count-placeholder"
                            role="status"
                            aria-label={t('Loading statistics')}
                          />
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-muted">{t('Updated hourly')}</p>
              </Stat>
            </div>

            <div className="statistics-grid">
              <Stat title={t('Connected to networks')}>
                <ul className="list-unstyled statistics-network-list">
                  {!statistics
                    ? Array.from({ length: 7 }, (_, index) => (
                        <li key={index}>
                          <div className="statistics-count-placeholder" />
                        </li>
                      ))
                    : statistics?.connections?.map(
                        ({ network, count, percentage }) => (
                          <Tooltip
                            key={network}
                            placement="right"
                            tooltip={t('{{count}} members', {
                              count: numberFormat(count),
                            })}
                          >
                            <li className="statistics-network-row">
                              <span className="statistics-network-label">
                                <span>{getNetworkName(network)}</span>
                                {legacyNetworks.has(network) && (
                                  <span className="statistics-legacy-label">
                                    {t('Legacy')}
                                  </span>
                                )}
                              </span>
                              <span className="statistics-network-percentage">
                                {Number(percentage).toFixed(1)}%
                              </span>
                            </li>
                          </Tooltip>
                        ),
                      )}
                </ul>
                {statistics && (
                  <p className="text-muted statistics-legacy-note">
                    {t(
                      'Couchsurfing, Facebook and GitHub percentages represent legacy connections from previously linked accounts.',
                    )}
                  </p>
                )}
              </Stat>
              <div className="statistics-metric-stack">
                <Stat title={t('Hosts')}>
                  {!statistics ? (
                    <>
                      <div className="statistics-count-placeholder" />
                      <div className="statistics-count-placeholder" />
                      <div className="statistics-count-placeholder" />
                    </>
                  ) : (
                    <>
                      <Tooltip
                        tooltip={t('{{count}} members', {
                          count: numberFormat(statistics?.hosting?.total ?? 0),
                        })}
                      >
                        <p className="statistics-count">{`${
                          statistics?.hosting?.percentage ?? 0
                        }%`}</p>
                      </Tooltip>
                      <Tooltip
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
                        tooltip={t('{{count}} members', {
                          count: statistics?.hosting?.maybe ?? 0,
                        })}
                        placement="bottom"
                      >
                        <p className="text-muted">
                          {t('{{percentage}}% maybe', {
                            percentage:
                              statistics?.hosting?.maybePercentage ?? 0,
                          })}
                        </p>
                      </Tooltip>
                    </>
                  )}
                </Stat>
                <Stat title={t('Newsletter')}>
                  {!statistics ? (
                    <>
                      <div className="statistics-count-placeholder" />
                      <div className="statistics-count-placeholder" />
                    </>
                  ) : (
                    <>
                      <p className="statistics-count">
                        {statistics?.newsletter?.percentage ?? 0}%
                      </p>
                      <p className="text-muted">
                        {t('{{count}} subscribers', {
                          count: statistics?.newsletter?.count ?? 0,
                        })}
                      </p>
                      {isAuthenticated && (
                        <p>
                          <Button
                            size="sm"
                            render={<a href="/profile/edit/account" />}
                          >
                            {t('Subscribe to newsletter')}
                          </Button>
                        </p>
                      )}
                    </>
                  )}
                </Stat>
              </div>
            </div>

            <div className="statistics-grid statistics-charts-grid">
              <StatisticsCharts />
            </div>

            <hr />

            <p className="lead">
              {t('Wanna help understand Trustroots more in depth?')}{' '}
              <a href="/support?category=volunteering">
                {t('Consider volunteering!')}
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
