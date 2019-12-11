import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

// @TODO missing validation

export default function OfferHostEditAvailability({
  status,
  onChangeStatus,
  maxGuests,
  onChangeMaxGuests,
}) {
  return (
    <div className="row">
      <div className="col-xs-12 col-sm-6">
        <div className="panel panel-default offer-meta">
          <div className="panel-body">
            <StatusInput value={status} onChange={onChangeStatus} />

            <br />
            <br />

            {status !== 'no' && (
              <MaxGuestsInput value={maxGuests} onChange={onChangeMaxGuests} />
            )}
          </div>
        </div>
      </div>

      <MotivationBanner />
    </div>
  );
}

OfferHostEditAvailability.propTypes = {
  status: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  onChangeStatus: PropTypes.func.isRequired,
  maxGuests: PropTypes.number.isRequired,
  onChangeMaxGuests: PropTypes.func.isRequired,
};

function MotivationBanner() {
  const { t } = useTranslation('offers');
  return (
    <div className="col-xs-12 col-sm-6 text-center hidden-xs">
      <div className="icon-sofa icon-3x text-muted" aria-hidden="true"></div>
      <h3>{t('Host Trustroots members')}</h3>
      <p className="lead">
        <em>
          {t(
            'Offering hospitality and welcoming “strangers” to our homes strengthens our faith in each other.',
          )}
        </em>
      </p>
    </div>
  );
}

function StatusInput({ value, onChange }) {
  const { t } = useTranslation('offers');

  const statusOptions = [
    { status: 'yes', label: t('Yes') },
    { status: 'maybe', label: t('Maybe') },
    { status: 'no', label: t('No') },
  ];

  return (
    <fieldset>
      <legend>
        <h4 id="offerStatus">{t('Can you host?')}</h4>
      </legend>
      <div
        className="btn-group"
        role="radiogroup"
        aria-labelledby="offerStatus"
      >
        {statusOptions.map(({ label, status }) => (
          <label
            key={status}
            className={`btn btn-lg btn-offer-hosting btn-offer-hosting-${status} ${
              value === status ? 'active' : ''
            }`}
            role="radio"
            aria-checked={value === status ? 'true' : 'false'}
            uib-btn-radio="'yes'"
            onClick={() => onChange(status)}
          >
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

StatusInput.propTypes = {
  value: PropTypes.oneOf(['yes', 'maybe', 'no']).isRequired,
  onChange: PropTypes.func.isRequired,
};

function MaxGuestsInput({ value, onChange }) {
  const { t } = useTranslation('offers');

  const isValid = value >= 1 && value <= 99;

  return (
    <fieldset className="offer-maxguests">
      <legend>
        <h4 id="maxGuests">{t('How many guests can you accommodate?')}</h4>
      </legend>
      <div className="input-group input-group-stepper">
        <span className="input-group-btn">
          <button
            type="button"
            className="btn btn-lg btn-inverse-primary btn-round"
            onClick={() => onChange(1, '-')}
            disabled={value <= 1}
            aria-hidden="true"
          >
            <i className="icon-minus"></i>
          </button>
        </span>
        <input
          type="number"
          aria-labelledby="maxGuests"
          aria-required="true"
          aria-invalid={isValid ? 'false' : 'true'}
          value={value}
          onChange={event => onChange(+event.target.value, '=')}
          className="form-control input-lg input-plain text-center font-brand-regular"
          maxLength="2"
          min="1"
          max="99"
          size="2"
          step="1"
          pattern="[0-9]{1,2}"
        />
        <span className="input-group-btn">
          <button
            type="button"
            className="btn btn-lg btn-inverse-primary btn-round"
            onClick={() => onChange(1, '+')}
            disabled={value >= 99}
            aria-hidden="true"
          >
            <i className="icon-plus"></i>
          </button>
        </span>
      </div>
    </fieldset>
  );
}

MaxGuestsInput.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};
