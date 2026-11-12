import React, { type ButtonHTMLAttributes, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import { Tooltip } from '@trustroots/ui/Tooltip';

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
        ? { intent: 'primary' as const, size: 'lg' as const }
        : { variant: 'link' as const, size: 'xl' as const })}
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
      intent="primary"
      size={small ? 'lg' : 'xl'}
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
      intent="primary"
      size={small ? 'lg' : 'xl'}
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
  function withDisabledReason(button: ReactElement) {
    if (!disabled || !disabledReason) return button;

    return (
      <Tooltip tooltip={disabledReason}>
        {/* A disabled button cannot receive pointer events or keyboard focus. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <span className="tw:inline-block" tabIndex={0}>
          {button}
        </span>
      </Tooltip>
    );
  }
  const showBackButton = currentStep > 0;
  const showNextButton = currentStep < numberOfSteps - 1;
  const showSubmitButton = currentStep === numberOfSteps - 1;

  return (
    <>
      <div className="text-center hidden-xs">
        {showBackButton && <BackButton {...backProps} />}
        {showNextButton && withDisabledReason(<NextButton {...nextProps} />)}
        {showSubmitButton &&
          withDisabledReason(<SubmitButton {...submitProps} />)}
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
                {withDisabledReason(<NextButton {...nextProps} small />)}
              </li>
            )}
            {showSubmitButton && (
              <li className="pull-right">
                {withDisabledReason(<SubmitButton {...submitProps} small />)}
              </li>
            )}
          </ul>
        </div>
      </nav>
    </>
  );
}
