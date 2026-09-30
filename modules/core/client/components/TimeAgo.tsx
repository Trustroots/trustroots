import PropTypes from 'prop-types';
import moment from 'moment';
import React, { useEffect, useState } from 'react';

const REFRESH_INTERVAL = 10000;

type TimeAgoProps = { date: Date };

export default function TimeAgo({ date }: TimeAgoProps) {
  const momentDate = moment(date);
  const [fromNow, setFromNow] = useState(momentDate.fromNow());

  useEffect(() => {
    const interval = setInterval(() => {
      setFromNow(momentDate.fromNow());
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <time dateTime={date.toString()} title={momentDate.format('LLLL')}>
      {fromNow}
    </time>
  );
}

TimeAgo.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
};
