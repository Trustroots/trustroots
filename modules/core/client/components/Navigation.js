import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

/**
 * Navigation is a react component.
 * It can contain three different buttons: Back, Next, Submit.
 * Each of them has a related property onBack, onNext, onSubmit
 */
export default function Navigation({
  disabled,
  tab,
  tabs,
  tabDone,
  onBack,
  onNext,
  onSubmit,
}) {
  const { t } = useTranslation('reference');

  const backButton = (
    <button
      type="button"
      className="btn btn-action btn-link"
      aria-label="Previous section"
      onClick={onBack}
    >
      <span className="icon-left"></span>
      {t('Back')}
    </button>
  );

  const nextButton = (
    <button
      type="button"
      className="btn btn-action btn-primary"
      aria-label="Next section"
      onClick={onNext}
      disabled={tabDone < tab}
    >
      {t('Next')}
    </button>
  );

  const submitButton = (
    <button
      className="btn btn-action btn-primary"
      aria-label="Submit reference"
      onClick={onSubmit}
      disabled={tabDone < tabs - 1 || disabled}
    >
      {t('Finish')}
    </button>
  );

  const showBackButton = tab > 0; // not the first tab
  const showNextButton = tab < tabs - 1; // not the last tab
  const showSubmitButton = tab === tabs - 1; // the last tab

  return (
    <div className="text-center">
      {showBackButton && backButton}
      {showNextButton && nextButton}
      {showSubmitButton && submitButton}
    </div>
  );
}

Navigation.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tab: PropTypes.number.isRequired, // current tab index - indexed from 0
  tabs: PropTypes.number.isRequired, // amount of tabs to display
  tabDone: PropTypes.number.isRequired, // which tab is already filled
};
