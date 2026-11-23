import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { timeAgo } from '../../shared/time-ago.mts';

const REFRESH_INTERVAL = 10000;

type TimeAgoProps = { date: Date };

export default function TimeAgo({ date }: TimeAgoProps) {
  const { i18n } = useTranslation();
  const [fromNow, setFromNow] = useState(() => timeAgo(date, i18n.language));

  useEffect(() => {
    const interval = setInterval(() => {
      setFromNow(timeAgo(date, i18n.language));
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [date, i18n.language]);

  return (
    <time
      dateTime={date.toString()}
      title={date.toLocaleString(i18n.language, {
        dateStyle: 'full',
        timeStyle: 'short',
      })}
    >
      {fromNow}
    </time>
  );
}
