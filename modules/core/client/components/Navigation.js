import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';

import Tooltip from './Tooltip';

const BackButton = ({ small, ...props }) => {
  const { t } = useTranslation('core');
  return (
    <button
      type="button"
      className={classnames({
        btn: true,
        'btn-lg': small,
        'btn-primary': small,
        'btn-action': !small,
        'btn-link': !small,
      })}
      aria-label={t('Previous section')}
      {...props}
    >
      <span className="icon-left" aria-hidden="true"></span>
      {t('Back')}
    </button>
  );
};
BackButton.propTypes = { small: PropTypes.bool };

const NextButton = ({ small, ...props }) => {
  const { t } = useTranslation('core');

  return (
    <button
      type="button"
      className={classnames({
        btn: true,
        'btn-lg': small,
        'btn-action': !small,
        'btn-primary': true,
      })}
      aria-label={t('Next section')}
      {...props}
    >
      {t('Next')}
      {small && <span className="icon-right" aria-hidden="true"></span>}
    </button>
  );
};
NextButton.propTypes = { small: PropTypes.bool };

const SubmitButton = ({ small, ...props }) => {
  const { t } = useTranslation('core');
  return (
    <button
      type="submit"
      className={classnames({
        btn: true,
        'btn-lg': small,
        'btn-action': !small,
        'btn-primary': true,
      })}
      aria-label={t('Finish editing and save')}
      {...props}
    >
      {t('Finish')}
      {small && <span className="icon-ok" aria-hidden="true"></span>}
    </button>
  );
};
SubmitButton.propTypes = { small: PropTypes.bool };

/**
 * Navigation is a react component.
 * It can contain three different buttons: Back, Next, Submit.
 * Each of them has a related property onBack, onNext, onSubmit
 */
export default function Navigation({
  disabled,
  tab,
  tabs,
  errors,
  onBack,
  onNext,
  onSubmit,
}) {
  const errorTab = errors.findIndex(errors_ => errors_.length > 0);
  const tabDone = errorTab === -1 ? tabs : errorTab - 1;
  // get the lowest error valid for the current tab
  const error = errors.slice(0, tab + 1).flat()[0] ?? '';

  /**
   * We'll reuse the buttons and tooltip defined below
   * either with different children or with additional props.
   * We use React.cloneElement(element, props, children) for that purpose:
   * https://reactjs.org/docs/react-api.html#cloneelement
   */
  const backButton = <BackButton onClick={onBack} />;
  const nextButton = <NextButton onClick={onNext} disabled={tabDone < tab} />;
  const submitButton = (
    <SubmitButton
      onClick={onSubmit}
      disabled={tabDone < tabs - 1 || disabled}
    />
  );
  const tooltip = (
    <Tooltip
      tooltip={error}
      id="tooltip-disabled-button"
      hidden={!error}
      placement="top"
    >
      placeholder
    </Tooltip>
  );

  const showBackButton = tab > 0; // not the first tab
  const showNextButton = tab < tabs - 1; // not the last tab
  const showSubmitButton = tab === tabs - 1; // the last tab

  return (
    <>
      <div className="text-center hidden-xs">
        {showBackButton && backButton}
        {showNextButton && cloneElement(tooltip, null, nextButton)}
        {showSubmitButton && cloneElement(tooltip, null, submitButton)}
      </div>
      <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block">
        <div className="container">
          <ul
            className="nav navbar-nav nav-justified"
            role="toolbar"
            aria-label="Offer actions"
          >
            {showBackButton && (
              <li>{cloneElement(backButton, { small: true })}</li>
            )}
            {showNextButton && (
              <li className="pull-right">
                {cloneElement(
                  tooltip,
                  null,
                  cloneElement(nextButton, { small: true }),
                )}
              </li>
            )}
            {showSubmitButton && (
              <li className="pull-right">
                {cloneElement(
                  tooltip,
                  null,
                  cloneElement(submitButton, { small: true }),
                )}
              </li>
            )}
          </ul>
        </div>
      </nav>
    </>
  );
}

Navigation.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  tab: PropTypes.number.isRequired, // current tab index - indexed from 0
  tabs: PropTypes.number.isRequired, // amount of tabs to display
  errors: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
};
