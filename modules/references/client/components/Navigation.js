import React from 'react';
import PropTypes from 'prop-types';

/**
 * Navigation is a react component.
 * It can contain three different buttons: Back, Next, Submit. Each of them has a related property onBack, onNext, onSubmit
 *
 */
export default function Navigation(props) {
  const back = (
    <button
      type="button"
      className="btn btn-action btn-link"
      aria-label="Previous section"
      onClick={props.onBack}>
      <span className="icon-left"></span>
      Back
    </button>
  );

  const next = (
    <button
      type="button"
      className="btn btn-action btn-primary"
      aria-label="Next section"
      onClick={props.onNext}
      disabled={props.tabDone < props.tab}>
      Next
    </button>
  );

  const submit = (
    <button
      className="btn btn-action btn-primary"
      aria-label="Submit reference"
      onClick={props.onSubmit}
      disabled={props.tabDone < props.tabs - 1}>
      Submit
    </button>
  );

  return (
    <div className="text-center">
      {(props.tab > 0) ? back : null}
      {(props.tab < props.tabs - 1) ? next : null}
      {/* <!-- For the last tab -->*/}
      {(props.tab === props.tabs - 1) ? submit : null}
    </div>

  );
}

Navigation.propTypes = {
  onBack: PropTypes.func,
  onNext: PropTypes.func,
  onSubmit: PropTypes.func,
  tab: PropTypes.number, // current tab index - indexed from 0
  tabs: PropTypes.number, // amount of tabs to display
  tabDone: PropTypes.number // which tab is already filled
};

