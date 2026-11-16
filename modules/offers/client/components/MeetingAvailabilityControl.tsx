import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingStatus } from '../../shared/offer';

type MeetingChoice = Exclude<MeetingStatus, 'not-set'>;

interface Props {
  value: MeetingStatus;
  onChange: (status: MeetingChoice) => void;
  disabled?: boolean;
}

export default function MeetingAvailabilityControl({
  value,
  onChange,
  disabled,
}: Props) {
  const id = useId();
  const { t } = useTranslation('offers');
  const options: [MeetingChoice, string][] = [
    ['yes', t('Yes')],
    ['maybe', t('Maybe')],
    ['no', t('No')],
  ];
  return (
    <fieldset className="meeting-availability-control" disabled={disabled}>
      <legend id={id}>{t('Would you like to meet people?')}</legend>
      <div aria-labelledby={id} className="btn-group" role="radiogroup">
        {options.map(([status, label]) => (
          <label
            key={status}
            className={`btn btn-lg btn-offer-hosting btn-offer-hosting-${status}${value === status ? ' active' : ''}`}
          >
            <input
              checked={value === status}
              className="offer-availability-radio"
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
