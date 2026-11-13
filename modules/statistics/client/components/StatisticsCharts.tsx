import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { getCharts } from '../api/statistics.api';
import type { PublicCharts } from '../../shared/public-charts.mts';
import Stat from './Stat';

const ChartTable = styled.table`
  width: 100%;
  text-align: left;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 4px;
  }

  tbody th {
    font-weight: normal;
  }

  td {
    width: 30%;
  }

  td > span {
    display: block;
    height: 5px;
    border-radius: 2px;
    background: #147963;
  }

  td:nth-child(3) > span {
    background: #3d6492;
  }
`;

function BarTable({
  caption,
  label,
  columns,
  rows,
}: {
  caption: string;
  label: string;
  columns: string[];
  rows: Array<{ label: string; counts: number[] }>;
}) {
  const maximum = Math.max(1, ...rows.flatMap(row => row.counts));
  const formatter = new Intl.NumberFormat();

  return (
    <ChartTable>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{label}</th>
          {columns.map(column => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {row.counts.map((count, index) => (
              <td key={columns[index]}>
                {formatter.format(count)}
                <span
                  aria-hidden="true"
                  style={{ width: `${(count / maximum) * 100}%` }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </ChartTable>
  );
}

export default function StatisticsCharts() {
  const { t } = useTranslation('statistics');
  const [charts, setCharts] = useState<PublicCharts | null>();
  useEffect(() => {
    getCharts().then(
      ({ data }) => setCharts(data),
      () => setCharts(null),
    );
  }, []);

  if (!charts) {
    return (
      <p role="status">
        {charts === null
          ? t('Chart data is unavailable.')
          : t('Loading charts…')}
      </p>
    );
  }

  const weeks = charts.weeks;
  const activity = charts.memberActivity;
  return (
    <>
      <Stat title={t('Weekly signups')}>
        <BarTable
          caption={t('Weekly signups')}
          label={t('Week starting (UTC)')}
          columns={[t('Signups')]}
          rows={weeks.map(week => ({
            label: week.weekStarting,
            counts: [week.signups],
          }))}
        />
      </Stat>
      <Stat title={t('Member activity')}>
        <BarTable
          caption={t('Member activity')}
          label={t('Last seen')}
          columns={[t('Members')]}
          rows={[
            { label: t('Past 7 days'), counts: [activity.past7Days] },
            { label: t('Past 14 days'), counts: [activity.past14Days] },
            { label: t('Past 30 days'), counts: [activity.past30Days] },
            { label: t('Past 6 months'), counts: [activity.past6Months] },
            { label: t('Past 12 months'), counts: [activity.past12Months] },
          ]}
        />
      </Stat>
      <Stat title={t('Conversations and first replies')}>
        <BarTable
          caption={t('Conversations and first replies')}
          label={t('Week starting (UTC)')}
          columns={[t('Conversations started'), t('First replies')]}
          rows={weeks.map(week => ({
            label: week.weekStarting,
            counts: [week.conversationsStarted, week.firstReplies],
          }))}
        />
      </Stat>
    </>
  );
}
