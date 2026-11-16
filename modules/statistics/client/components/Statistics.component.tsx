// External dependencies
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

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

const statisticsGridClass = 'tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2';
const countClass =
  'tw:text-[50px] tw:leading-[55px] tw:font-light tw:text-[#12b591]';
const placeholderClass = 'tw:inline-block tw:h-5 tw:min-w-5 tw:bg-[#eee]';

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
            <div className={statisticsGridClass}>
              <Stat title={t('Real-life connections')}>
                {!statistics ? (
                  <div className={placeholderClass} />
                ) : (
                  <>
                    <div>
                      <p className={countClass}>
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
                    <div className="tw:mt-5">
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

              <Stat title={t('Message interactions')}>
                {!statistics ? (
                  <div className={placeholderClass} />
                ) : (
                  <>
                    <div>
                      <p className={countClass}>
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
                    <div className="tw:mt-5">
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
                  <div className={placeholderClass} />
                ) : (
                  <>
                    <p className={countClass}>
                      {numberFormat(statistics?.total)}
                    </p>
                    <div className="tw:mt-2 tw:grid tw:w-full tw:grid-cols-2 tw:gap-4 tw:[border-top:1px_solid_#eee] tw:pt-4 tw:[&>p]:m-0 tw:[&>p+p]:[border-inline-start:1px_solid_#eee] tw:[&>p+p]:ps-4">
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

              <Stat title={t('Recent activity')}>
                <table className="tw:m-0 tw:w-full tw:text-start tw:text-[16px] tw:[&_th,&_td]:px-[5px] tw:[&_th,&_td]:py-2 tw:[&_th,&_td]:text-end tw:[&_th:first-child,&_td:first-child]:text-start tw:[&_thead_th]:[border-bottom:2px_solid_#eee] tw:[&_thead_th]:align-bottom tw:[&_thead_th]:text-[13px] tw:[&_tbody_th,&_tbody_td]:[border-bottom:1px_solid_#eee] tw:[&_tbody_tr:last-child_th,&_tbody_tr:last-child_td]:border-b-0">
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
                            className={placeholderClass}
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
                            className={placeholderClass}
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
                            className={placeholderClass}
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
                            className={placeholderClass}
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

            <div className={`${statisticsGridClass} tw:mt-5`}>
              <Stat title={t('Connected to networks')}>
                <ul className="list-unstyled tw:m-0 tw:w-full tw:max-w-[300px] tw:text-[18px]">
                  {!statistics
                    ? Array.from({ length: 7 }, (_, index) => (
                        <li key={index}>
                          <div className={placeholderClass} />
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
                            <li className="tw:grid tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-4 tw:[border-bottom:1px_solid_#eee] tw:px-[2px] tw:py-[7px] tw:last:border-b-0">
                              <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-[7px]">
                                <span>{getNetworkName(network)}</span>
                                {legacyNetworks.has(network) && (
                                  <span className="tw:rounded-[10px] tw:bg-[#eee] tw:px-[6px] tw:text-[9px] tw:leading-4 tw:font-semibold tw:tracking-[0.04em] tw:text-[#666] tw:uppercase">
                                    {t('Legacy')}
                                  </span>
                                )}
                              </span>
                              <span className="tw:font-medium tw:text-[#555] tw:tabular-nums">
                                {Number(percentage).toFixed(1)}%
                              </span>
                            </li>
                          </Tooltip>
                        ),
                      )}
                </ul>
                {statistics && (
                  <p className="text-muted tw:mx-auto tw:mt-[14px] tw:mb-0 tw:max-w-[300px] tw:text-[12px] tw:leading-[1.4]">
                    {t(
                      'Couchsurfing, Facebook and GitHub percentages represent legacy connections from previously linked accounts.',
                    )}
                  </p>
                )}
              </Stat>
              <div className="tw:grid tw:grid-cols-1 tw:gap-5">
                <Stat title={t('Hosts')}>
                  {!statistics ? (
                    <>
                      <div className={placeholderClass} />
                      <div className={placeholderClass} />
                      <div className={placeholderClass} />
                    </>
                  ) : (
                    <>
                      <Tooltip
                        tooltip={t('{{count}} members', {
                          count: numberFormat(statistics?.hosting?.total ?? 0),
                        })}
                      >
                        <p className={countClass}>{`${
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
                      <div className={placeholderClass} />
                      <div className={placeholderClass} />
                    </>
                  ) : (
                    <>
                      <p className={countClass}>
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

            <div
              className={`${statisticsGridClass} tw:mt-5 tw:[&>*:last-child]:col-span-full`}
            >
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
