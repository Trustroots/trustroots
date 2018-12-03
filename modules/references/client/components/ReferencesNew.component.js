import React from 'react';
import PropTypes from 'prop-types';
import * as references from './references.api';
import Navigation from './Navigation';
import Interaction from './Interaction';
import Recommend from './Recommend';
import { Self, Loading, Duplicate, Submitted } from './Info';
import { Tab, Tabs } from 'react-bootstrap';

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
      reportMessage: '',
      isSelf: props.userFrom._id === props.userTo._id,
      isLoading: true,
      isSubmitting: false,
      isDuplicate: false,
      isSubmitted: false,
      isPublic: false
    };
  }

  async componentDidMount() {
    const reference = await api.references.read({ userFrom: this.props.userFrom._id, userTo: this.props.userTo._id });

    const newState = { isLoading: false };

    if (reference.length === 1) newState.isDuplicate = true;

    this.setState(newState);
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

    this.setState({
      isSubmitting: true
    });

    const savedReference = await api.references.create({ ...data.reference, userTo: this.props.userTo._id });

    if (data.reference.recommend === 'no' && data.report) {
      await api.references.report(this.props.userTo, data.reportMessage);
    }

    this.setState({
      isSubmitting: false,
      isSubmitted: true,
      isPublic: savedReference.public
    });
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

    if (this.state.isSelf) return <Self />;

    if (this.state.isLoading) return <Loading />;

    if (this.state.isDuplicate) return <Duplicate userTo={this.props.userTo} />;

    if (this.state.isSubmitted) {
      const isReported = this.state.reference.recommend === 'no' && this.state.report;
      const isPublic = this.state.isPublic;
      return <Submitted isReported={isReported} isPublic={isPublic} userTo={this.props.userTo} />;
    }

    return (
      <div>
        <Tabs
          activeKey={this.state.tab}
          bsStyle="pills"
          onSelect={() => {}}
          id="create-reference-tabs"
        >
          <Tab
            eventKey={0}
            title="How do you know them"
          >{tabs[0]}</Tab>
          <Tab
            eventKey={1}
            title="Recommendation"
          >{tabs[1]}</Tab>
        </Tabs>
        {/* <!-- Navigation for big screens -->*/}
        <Navigation
          tab={this.state.tab}
          tabDone={tabDone}
          tabs={tabs.length}
          disabled={this.state.isSubmitting}
          onBack={() => this.handleTabSwitch(-1)}
          onNext={() => this.handleTabSwitch(+1)}
          onSubmit={() => this.handleSubmit()}
        />
      </div>
    );
  }
}

ReferencesNew.propTypes = {
  userFrom: PropTypes.object,
  userTo: PropTypes.object
};
