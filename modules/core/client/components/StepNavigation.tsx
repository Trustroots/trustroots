import PropTypes from 'prop-types';
import React, { type ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Tooltip from './Tooltip';

type StepButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  small?: boolean;
};

type SubmitButtonProps = StepButtonProps & { label?: string };

type StepNavigationProps = {
  currentStep: number;
  numberOfSteps: number;
  disabled?: boolean;
  disabledReason?: string;
  submitLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

const BackButton = ({ small, ...props }: StepButtonProps) => {
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
      aria-label={t<string>('Previous section')}
      {...props}
    >
      <span className="icon-left" aria-hidden="true"></span>
      {t<string>('Back')}
    </button>
  );
};

const NextButton = ({ small, ...props }: StepButtonProps) => {
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
      aria-label={t<string>('Next section')}
      {...props}
    >
      {t<string>('Next')}
      {small && <span className="icon-right" aria-hidden="true"></span>}
    </button>
  );
};

const SubmitButton = ({ small, label, ...props }: SubmitButtonProps) => {
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
      aria-label={label || t<string>('Finish editing and save')}
      {...props}
    >
      {label || t<string>('Finish')}
      {small && <span className="icon-ok" aria-hidden="true"></span>}
    </button>
  );
};
export default function StepNavigation({
  currentStep,
  numberOfSteps,
  disabled = false,
  disabledReason = '',
  onBack,
  onNext,
  onSubmit,
  submitLabel,
}: StepNavigationProps) {
  const backProps = { onClick: onBack };
  const nextProps = { onClick: onNext, disabled };
  const submitProps = { onClick: onSubmit, disabled, label: submitLabel };
  const tooltipProps = {
    tooltip: disabledReason,
    id: 'tooltip-disabled-button',
    hidden: !(disabled && disabledReason),
    placement: 'top' as const,
  };
  const showBackButton = currentStep > 0;
  const showNextButton = currentStep < numberOfSteps - 1;
  const showSubmitButton = currentStep === numberOfSteps - 1;

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

BackButton.propTypes = { small: PropTypes.bool };
NextButton.propTypes = { small: PropTypes.bool };
SubmitButton.propTypes = { small: PropTypes.bool };
StepNavigation.propTypes = {
  currentStep: PropTypes.number.isRequired,
  numberOfSteps: PropTypes.number.isRequired,
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string,
};
