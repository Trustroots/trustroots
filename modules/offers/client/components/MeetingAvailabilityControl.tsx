import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingStatus } from '../../shared/offer';

interface Props {
  value: MeetingStatus;
  onChange: (status: MeetingStatus) => void;
  disabled?: boolean;
}

export default function MeetingAvailabilityControl({
  value,
  onChange,
  disabled,
}: Props) {
  const id = useId();
  const { t } = useTranslation('offers');
  const options: [MeetingStatus, string][] = [
    ['yes', t('Yes')],
    ['maybe', t('Maybe')],
    ['no', t('No')],
    ['not-set', t('Not set')],
  ];
  return (
    <fieldset className="meeting-availability-control" disabled={disabled}>
      <legend id={id}>{t('Would you like to meet people?')}</legend>
      <div aria-labelledby={id} className="btn-group" role="radiogroup">
        {options.map(([status, label]) => (
          <label
            key={status}
            className={`btn btn-lg ${status === 'not-set' ? 'btn-default' : `btn-offer-hosting btn-offer-hosting-${status}`}${value === status ? ' active' : ''}`}
          >
            <input
              checked={value === status}
              className="sr-only"
              name={id}
              onChange={() => onChange(status)}
              type="radio"
              value={status}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
