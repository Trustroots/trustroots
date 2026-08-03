import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const MONTHS = [
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' },
];

function parseBirthdate(value) {
  if (!value) {
    return { date: '', month: '', year: '' };
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return { date: '', month: '', year: '' };
  }

  return {
    date: parsed.getUTCDate(),
    month: parsed.getUTCMonth() + 1,
    year: parsed.getUTCFullYear(),
  };
}

function toBirthdate({ date, month, year }) {
  if (!date || !month || !year) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, date)).toISOString();
}

export default function BirthdateSelect({ value, onChange }) {
  const [parts, setParts] = useState(() => parseBirthdate(value));
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () =>
      Array.from(
        { length: currentYear - 1899 },
        (_, index) => currentYear - index,
      ),
    [currentYear],
  );

  useEffect(() => {
    setParts(parseBirthdate(value));
  }, [value]);

  const dates = useMemo(() => {
    const daysInMonth =
      parts.month && parts.year
        ? new Date(parts.year, parts.month, 0).getDate()
        : 31;

    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }, [parts.month, parts.year]);

  function updatePart(key, nextValue) {
    const nextParts = {
      ...parts,
      [key]: nextValue ? Number(nextValue) : '',
    };

    setParts(nextParts);
    onChange(toBirthdate(nextParts));
  }

  return (
    <div className="form-inline">
      <label className="sr-only" htmlFor="birthdate-month">
        Month
      </label>
      <select
        className="form-control"
        id="birthdate-month"
        value={parts.month || ''}
        onChange={event => updatePart('month', event.target.value)}
      >
        <option value="">Month</option>
        {MONTHS.map(month => (
          <option key={month.value} value={month.value}>
            {month.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="birthdate-date">
        Day
      </label>
      <select
        className="form-control"
        id="birthdate-date"
        value={parts.date || ''}
        onChange={event => updatePart('date', event.target.value)}
      >
        <option value="">Day</option>
        {dates.map(date => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="birthdate-year">
        Year
      </label>
      <select
        className="form-control"
        id="birthdate-year"
        value={parts.year || ''}
        onChange={event => updatePart('year', event.target.value)}
      >
        <option value="">Year</option>
        {years.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}

BirthdateSelect.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
};
