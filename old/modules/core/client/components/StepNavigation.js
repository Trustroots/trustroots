import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Tooltip from './Tooltip';

/**
 * StepNavigation can contain three different buttons: Back, Next, Submit we can go through.
 * Each of them has a related property onBack, onNext, onSubmit.
 * See it at `/offer/host` or `/profile/{username}/references/new`.
 * This component doesn't keep its own state.
 *
 * @param {number} currentStep - index of current step
 *                               first step doesn't have Back button
 *                               last step has Finish/Submit button instead of Next
 * @param {number} numberOfSteps - amount of steps in total
 * @param {boolean} [disabled] - disable Next button
 * @param {string} [disabledReason] - message to show in tooltip of disabled button
 * @param {function} onBack - method executed on clicking Back
 * @param {function} onNext - method executed on clicking Next
 * @param {function} onSubmit - method executed on clicking Submit
 */

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

export default function StepNavigation({
  currentStep,
  numberOfSteps,
  disabled = false,
  disabledReason = '',
  onBack,
  onNext,
  onSubmit,
}) {
  /**
   * We'll reuse the buttons and tooltip defined below
   * either with different children or with additional props.
   * We use React.cloneElement(element, props, children) for that purpose:
   * https://reactjs.org/docs/react-api.html#cloneelement
   */
  const backProps = { onClick: onBack };
  const nextProps = { onClick: onNext, disabled };
  const submitProps = { onClick: onSubmit, disabled };
  const tooltipProps = {
    tooltip: disabledReason,
    id: 'tooltip-disabled-button',
    hidden: !(disabled && disabledReason),
    placement: 'top',
  };

  const showBackButton = currentStep > 0; // not the first step
  const showNextButton = currentStep < numberOfSteps - 1; // not the last step
  const showSubmitButton = currentStep === numberOfSteps - 1; // the last step

  return (
    <>
      <div className="text-center hidden-xs">
        {showBackButton && <BackButton {...backProps} />}
        {showNextButton && (
          <Tooltip {...tooltipProps}>
            <NextButton {...nextProps} />
          </Tooltip>
        )}
        {showSubmitButton && (
          <Tooltip {...tooltipProps}>
            <SubmitButton {...submitProps} />
          </Tooltip>
        )}
      </div>
      <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block">
        <div className="container">
          <ul
            className="nav navbar-nav nav-justified"
            role="toolbar"
            aria-label="Offer actions"
          >
            {showBackButton && (
              <li>
                <BackButton {...backProps} small />
              </li>
            )}
            {showNextButton && (
              <li className="pull-right">
                <Tooltip {...tooltipProps}>
                  <NextButton {...nextProps} small />
                </Tooltip>
              </li>
            )}
            {showSubmitButton && (
              <li className="pull-right">
                <Tooltip {...tooltipProps}>
                  <SubmitButton {...submitProps} small />
                </Tooltip>
              </li>
            )}
          </ul>
        </div>
      </nav>
    </>
  );
}

StepNavigation.propTypes = {
  currentStep: PropTypes.number.isRequired, // current step index - indexed from 0
  numberOfSteps: PropTypes.number.isRequired, // amount of steps to go through
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
