import React from 'react';
import PropTypes from 'prop-types';

/**
 * Presentational component for picking an interaction
 */
export default function Interaction({ interactions, onChange }) {
  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="howDoYouKnowThemQuestion">How do you know them?</h4>
      </div>
      <div className="panel-body">
        <div role="group" aria-labelledby="howDoYouKnowThemQuestion">
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.met}
                onChange={() => onChange('met')}
              />
              Met in person
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.hostedThem}
                onChange={() => onChange('hostedThem')}
              />
              I hosted them
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={interactions.hostedMe}
                onChange={() => onChange('hostedMe')}
              />
              They hosted me
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

Interaction.propTypes = {
  onChange: PropTypes.func.isRequired,
  interactions: PropTypes.object.isRequired
};
