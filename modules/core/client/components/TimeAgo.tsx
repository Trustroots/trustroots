import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { timeAgo } from '../../shared/time-ago.mts';

const REFRESH_INTERVAL = 10000;

type TimeAgoProps = { date: Date };

export default function TimeAgo({ date }: TimeAgoProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.replace(/_/g, '-');
  const [fromNow, setFromNow] = useState(() => timeAgo(date, locale));

  useEffect(() => {
    const interval = setInterval(() => {
      setFromNow(timeAgo(date, locale));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [date, locale]);

  return (
    <time
      dateTime={date.toString()}
      title={date.toLocaleString(locale, {
        dateStyle: 'full',
        timeStyle: 'short',
      })}
    >
      {fromNow}
    </time>
  );
}
