import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';
import { hostStatusIntent } from './hostStatusIntent';
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
      <legend>
        <h4 id={id}>{t('Are you open to meeting people?')}</h4>
      </legend>
      <ButtonGroup aria-labelledby={id} role="radiogroup" size="lg">
        {options.map(([status, label]) => (
          <Button
            key={status}
            intent={hostStatusIntent[status]}
            variant="soft"
            // The radio is rendered inside the label below.
            // eslint-disable-next-line jsx-a11y/label-has-associated-control
            render={<label />}
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
          </Button>
        ))}
      </ButtonGroup>
    </fieldset>
  );
}
