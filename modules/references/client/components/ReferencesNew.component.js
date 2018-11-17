import React from 'react';
import PropTypes from 'prop-types';
import * as references from './references.api';
import Navigation from './Navigation';
import Interaction from './Interaction';
import Recommend from './Recommend';

const api = { references };

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

  handleChangeInteraction(interactionType) {
    const interaction = { };
    interaction[interactionType] = !this.state.reference.interactions[interactionType];
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

  handleChangeRecommend(recommend) {
    this.setState({
      reference: {
        ...this.state.reference,
        recommend
      }
    });
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

    if (data.reference.recommend === 'no' && data.report) {
      await api.references.report(this.props.userTo, data.reportMessage);
    }
  }

  render() {
    const tabs = [
      <Interaction key="interaction" reference={this.state.reference} onChange={(type) => this.handleChangeInteraction(type)} />,
      <Recommend
        key="recommend"
        reference={this.state.reference}
        report={this.state.report}
        onChangeRecommend={(recommend) => this.handleChangeRecommend(recommend)}
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
