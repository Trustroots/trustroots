import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';

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
      uib-tooltip="Write longer description first"
      tooltip-enable="offerHostEdit.isDescriptionTooShort && offerHostEdit.offerTab === 1"
      ng-disabled="offerHostEdit.isDescriptionTooShort && offerHostEdit.offerTab === 1"
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
  tabDone,
  onBack,
  onNext,
  onSubmit,
}) {
  const backButtonProps = {
    onClick: onBack,
  };

  const nextButtonProps = {
    onClick: onNext,
    disabled: tabDone < tab,
  };

  const submitButtonProps = {
    onClick: onSubmit,
    disabled: tabDone < tabs - 1 || disabled,
  };

  const showBackButton = tab > 0; // not the first tab
  const showNextButton = tab < tabs - 1; // not the last tab
  const showSubmitButton = tab === tabs - 1; // the last tab

  return (
    <>
      <div className="text-center hidden-xs">
        {showBackButton && <BackButton {...backButtonProps} />}
        {showNextButton && <NextButton {...nextButtonProps} />}
        {showSubmitButton && <SubmitButton {...submitButtonProps} />}
      </div>
      <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block">
        <div className="container">
          <ul
            className="nav navbar-nav nav-justified"
            role="toolbar"
            aria-label="Offer actions"
          >
            <li></li>
            <li className="pull-right">{/* <!-- For last tab --> */}</li>
            {showBackButton && (
              <li>
                <BackButton small {...backButtonProps} />
              </li>
            )}
            {showNextButton && (
              <li className="pull-right">
                <NextButton small {...nextButtonProps} />
              </li>
            )}
            {showSubmitButton && (
              <li className="pull-right">
                <SubmitButton small {...submitButtonProps} />
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
  tabDone: PropTypes.number.isRequired, // which tab is already filled
};
