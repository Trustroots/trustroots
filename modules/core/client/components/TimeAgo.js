import moment from 'moment';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const REFRESH_INTERVAL = 10000; // 10s

/**
 *  An automatically refreshing time ago component.
 *
 *  It refreshes every 10 seconds. If this seems a bit inefficient at some point
 *  e.g. there are loads of components pointlessly refreshing, there are two things
 *  we could do:
 *    1. share the setInterval across all instances
 *    2. switch to slower updates for further ago dates
 *
 *  Why not use one of the existing components/libraries?
 *
 *  Well, I think it's useful to be able to reuse our date formatting library,
 *  given we have it already. But, lets see, can always switch it out later...
 */
export default function TimeAgo({ date }) {
  const momentDate = moment(date);

  const [fromNow, setFromNow] = useState(momentDate.fromNow());

  useEffect(() => {
    const interval = setInterval(() => {
      setFromNow(momentDate.fromNow());
    }, REFRESH_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [date]);

  return (
    <time dateTime={date} title={momentDate.format('LLLL')}>
      {fromNow}
    </time>
  );
}

TimeAgo.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
};
