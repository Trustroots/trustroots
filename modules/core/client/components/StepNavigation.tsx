import React, { type ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
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
    <Button
      type="button"
      {...(small
        ? { colour: 'primary' as const, size: 'lg' as const }
        : { variant: 'link' as const, size: 'action' as const })}
      aria-label={t('Previous section')}
      {...props}
    >
      <span className="icon-left" aria-hidden="true"></span>
      {t('Back')}
    </Button>
  );
};

const NextButton = ({ small, ...props }: StepButtonProps) => {
  const { t } = useTranslation('core');
  return (
    <Button
      type="button"
      colour="primary"
      size={small ? 'lg' : 'action'}
      aria-label={t('Next section')}
      {...props}
    >
      {t('Next')}
      {small && <span className="icon-right" aria-hidden="true"></span>}
    </Button>
  );
};

const SubmitButton = ({ small, label, ...props }: SubmitButtonProps) => {
  const { t } = useTranslation('core');
  return (
    <Button
      type="submit"
      colour="primary"
      size={small ? 'lg' : 'action'}
      aria-label={label || t('Finish editing and save')}
      {...props}
    >
      {label || t('Finish')}
      {small && <span className="icon-ok" aria-hidden="true"></span>}
    </Button>
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
