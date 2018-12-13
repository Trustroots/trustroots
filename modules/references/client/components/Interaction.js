import React from 'react';
import PropTypes from 'prop-types';

export default function Interaction(props) {

  const { reference: { interactions } } = props;
  const isInteraction = [...Object.keys(interactions)].reduce((accumulator, current) => accumulator || interactions[current], false);
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
                checked={props.reference.interactions.met}
                onChange={() => props.onChange('met')}
              />
              Met in person
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={props.reference.interactions.hostedThem}
                onChange={() => props.onChange('hostedThem')}
              />
              I hosted them
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                checked={props.reference.interactions.hostedMe}
                onChange={() => props.onChange('hostedMe')}
              />
              They hosted me
            </label>
          </div>
        </div>
        {(!isInteraction) ? (
          <div className="alert alert-warning reference-new-tabs-alert" role="alert">
            Please tell us about your interaction.
          </div>
        ) : null}
      </div>
    </div>
  );
}

Interaction.propTypes = {
  onChange: PropTypes.func.isRequired,
  reference: PropTypes.object.isRequired
};
