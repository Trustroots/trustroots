import React from 'react';
import PropTypes from 'prop-types';
import * as references from './references.api';

const api = { references };

function Interaction(props) {

  const { reference: { interactions } } = props;
  const isInteraction = [...Object.keys(interactions)].reduce((accumulator, current) => accumulator || interactions[current], false);
  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="howDoYouKnowThemQuestion">How do you know them?</h4>
      </div>
      <div className="panel-body">
        <div role="group" aria-labelledby="howDoYouKnowThemQuestion">
          <label>
            <input
              type="checkbox"
              checked={props.reference.interactions.met}
              onChange={() => props.onChange('interactions', 'met')}
            />
            Met in person
          </label>
          <br /><br />
          <label>
            <input
              type="checkbox"
              checked={props.reference.interactions.hostedThem}
              onChange={() => props.onChange('interactions', 'hostedThem')}
            />
            I hosted them
          </label>
          <br /><br />
          <label>
            <input
              type="checkbox"
              checked={props.reference.interactions.hostedMe}
              onChange={(event) => props.onChange('interactions', 'hostedMe', event)}
            />
            They hosted me
          </label>
        </div>
        {(!isInteraction) ? (
          <div className="alert alert-warning reference-new-tabs-alert" role="alert">
            Sorry, you cannot leave them a reference if you didn&apos;t have any previous interraction.
          </div>
        ) : null}
      </div>
    </div>
  );
}

Interaction.propTypes = {
  onChange: PropTypes.func,
  reference: PropTypes.object
};

function Recommend(props) {

  const { hostedMe, hostedThem } = props.reference.interactions;
  const maxInteraction = (hostedMe) ? 'hostedMe' : (hostedThem) ? 'hostedThem' : 'met';
  const recommendQuestions = {
    hostedMe: 'Would you recommend others to stay with them?',
    hostedThem: 'Would you recommend others to host them?',
    met: 'Would you recommend others to meet them?'
  };

  return (
    <div className="panel panel-default">
      <div className="panel-heading" ng-switch="referenceNew.recommendationQuestion" id="recommendationQuestion">
        <h4>{recommendQuestions[maxInteraction]}</h4>
      </div>
      <div className="panel-body">
        <div className="btn-group"
          role="radiogroup"
          aria-labelledby="recommendationQuestion">
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-yes"
            role="radio"
            aria-checked={ props.reference.recommend === 'yes' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'yes'}
              onChange={() => props.onChange('recommend', 'yes')}
            />
            <span>Yes</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-no"
            role="radio"
            aria-checked={ props.reference.recommend === 'no' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'no'}
              onChange={() => props.onChange('recommend', 'no')}
            />
            <span>No</span>
          </label>
          <label className="btn btn-lg btn-reference-recommend btn-reference-recommend-unknown"
            role="radio"
            aria-checked={props.reference.recommend === 'unknown' }>
            <input
              type="radio"
              name="recommend"
              checked={props.reference.recommend === 'unknown'}
              onChange={() => props.onChange('recommend', 'unknown')}
            />
            <span>I don&apos;t know</span>
          </label>
        </div>
        {(!props.reference.recommend) ?
          <div className="alert alert-warning reference-new-tabs-alert" role="alert" ng-if="!referenceNew.reference.recommend && referenceNew.recommendationWarning">
            Please choose if you can recommend them.
          </div> : null}
        {(props.reference.recommend === 'no') ?
          <Report
            onChangeReport={props.onChangeReport}
            onChangeReportMessage={props.onChangeReportMessage}
            report={props.report}
            reportMessage={props.reportMessage}
          /> : null}
      </div>
    </div>
  );
}

Recommend.propTypes = {
  reference: PropTypes.object,
  onChange: PropTypes.func,
  onChangeReportMessage: PropTypes.func,
  onChangeReport: PropTypes.func,
  onChangeReportMessage: PropTypes.func,
  report: PropTypes.bool,
  reportMessage: PropTypes.string
};

function Report(props) {
  return (
    <div>
      <br /><br />
      <p className="lead">
        We&apos;re sad to hear you didn&apos;t have great experience using Trustroots! 😞
      </p>
      <label>
        <input
          type="checkbox"
          checked={props.report}
          onChange={props.onChangeReport}
        />
        Report this person to moderators
      </label>
      <br /><br />
      {(props.report) ?
        <div>
          <label htmlFor="report-message" className="control-label">Message to moderators</label>
          <textarea className="form-control input-lg"
            rows="7"
            id="message"
            onChange={(event) => props.onChangeReportMessage(event.target.value)}
            value={props.reportMessage}
          ></textarea>
          <span className="help-block">
            Please write in English if possible.<br />
          </span>
        </div> : null
      }
    </div>
  );
}

Report.propTypes = {
  report: PropTypes.bool,
  reportMessage: PropTypes.string,
  onChangeReport: PropTypes.func,
  onChangeReportMessage: PropTypes.func
};

export function Navigation(props) {
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

export default class ReferencesNew extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tab: 0,
      reference: {
        interactions: {
          met: false,
          hostedThem: false,
          hostedMe: false
        },
        recommend: null
      },
      report: false,
      reportMessage: ''
    };
  }

  handleTabSwitch(move) {
    this.setState({
      tab: this.state.tab + move
    });
  }

  handleChange(field, ...data) {
    if (field === 'interactions') {
      const interaction = { };
      interaction[data[0]] = !this.state.reference.interactions[data[0]];
      this.setState({
        reference: {
          ...this.state.reference,
          interactions: {
            ...this.state.reference.interactions,
            ...interaction
          }
        }
      });
    }

    if (field === 'recommend') {
      this.setState({
        reference: {
          ...this.state.reference,
          recommend: data[0]
        }
      });
    }
  }

  handleChangeReport() {
    this.setState({
      report: !this.state.report
    });
  }

  handleChangeReportMessage(reportMessage) {
    this.setState({
      reportMessage
    });
  }

  async handleSubmit() {
    const data = {
      reference: this.state.reference,
      report: this.state.report,
      reportMessage: this.state.reportMessage
    };

    await api.references.create({ ...data.reference, userTo: this.props.userTo._id });
  }

  render() {
    const tabs = [
      <Interaction key="interaction" reference={this.state.reference} onChange={(...data) => this.handleChange(...data)} />,
      <Recommend
        key="recommend"
        reference={this.state.reference}
        onChange={(...data) => this.handleChange(...data)}
        report={this.state.report}
        reportMessage={this.state.reportMessage}
        onChangeReport={() => this.handleChangeReport()}
        onChangeReportMessage={(reportMessage) => this.handleChangeReportMessage(reportMessage)}
      />
    ];

    const { interactions: { hostedMe, hostedThem, met }, recommend } = this.state.reference;

    const tabDone = (recommend) ? 1 :
      (hostedMe || hostedThem || met) ? 0 : -1;

    return (
      <div>
        <nav><span>How do you know them</span> &gt; <span>Recommendation</span></nav>
        {tabs[this.state.tab]}
        {/* <!-- Navigation for big screens -->*/}
        <Navigation
          tab={this.state.tab}
          tabDone={tabDone}
          tabs={tabs.length}
          onBack={() => this.handleTabSwitch(-1)}
          onNext={() => this.handleTabSwitch(+1)}
          onSubmit={() => this.handleSubmit()}
        />
      </div>
    );
  }
}

ReferencesNew.propTypes = {
  userTo: PropTypes.object
};
