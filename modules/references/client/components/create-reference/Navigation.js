import React from 'react';
import PropTypes from 'prop-types';

/**
 * Navigation is a react component.
 * It can contain three different buttons: Back, Next, Submit. Each of them has a related property onBack, onNext, onSubmit
 *
 */
export default function Navigation(props) {
  const backButton = (
    <button
      type="button"
      className="btn btn-action btn-link"
      aria-label="Previous section"
      onClick={props.onBack}>
      <span className="icon-left"></span>
      Back
    </button>
  );

  const nextButton = (
    <button
      type="button"
      className="btn btn-action btn-primary"
      aria-label="Next section"
      onClick={props.onNext}
      disabled={props.tabDone < props.tab}>
      Next
    </button>
  );

  const submitButton = (
    <button
      className="btn btn-action btn-primary"
      aria-label="Submit reference"
      onClick={props.onSubmit}
      disabled={props.tabDone < props.tabs - 1 || props.disabled}>
      Submit
    </button>
  );

  const showBackButton = props.tab > 0; // not the first tab
  const showNextButton = props.tab < props.tabs - 1; // not the last tab
  const showSubmitButton = props.tab === props.tabs - 1; // the last tab

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
  tabDone: PropTypes.number.isRequired // which tab is already filled
};

