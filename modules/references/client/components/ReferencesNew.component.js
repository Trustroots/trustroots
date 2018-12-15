import React from 'react';
import PropTypes from 'prop-types';
import * as references from '../api/references.api';
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
      met: false,
      hostedThem: false,
      hostedMe: false,
      recommend: null,
      report: false,
      reportMessage: '',
      tab: 0,
      isSelf: props.userFrom._id === props.userTo._id,
      isLoading: true,
      isSubmitting: false,
      isDuplicate: false,
      isSubmitted: false,
      isPublic: false
    };

    // bind methods
    this.handleTabSwitch = this.handleTabSwitch.bind(this);
    this.handleChangeInteraction = this.handleChangeInteraction.bind(this);
    this.handleChangeRecommend = this.handleChangeRecommend.bind(this);
    this.handleChangeReport = this.handleChangeReport.bind(this);
    this.handleChangeReportMessage = this.handleChangeReportMessage.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  async componentDidMount() {
    const reference = await api.references.read({ userFrom: this.props.userFrom._id, userTo: this.props.userTo._id });

    this.setState(() => {
      const newState = { isLoading: false };
      if (reference.length === 1) newState.isDuplicate = true;
      return newState;
    });
  }

  handleTabSwitch(move) {
    this.setState(state => ({
      tab: state.tab + move
    }));
  }

  handleChangeInteraction(interactionType) {
    this.setState(state => {
      const interaction = { };
      interaction[interactionType] = !state[interactionType];
      return interaction;
    });
  }

  handleChangeRecommend(recommend) {
    this.setState(() => ({ recommend }));
  }

  handleChangeReport() {
    this.setState(state => ({ report: !state.report }));
  }

  handleChangeReportMessage(reportMessage) {
    this.setState(() => ({ reportMessage }));
  }

  async handleSubmit() {
    // start submitting
    this.setState(() => ({ isSubmitting: true }));

    // get data from state
    const { met, hostedThem, hostedMe, recommend, report, reportMessage } = this.state;
    const reference = { met, hostedThem, hostedMe, recommend };

    // save the reference
    const savedReference = await api.references.create({ ...reference, userTo: this.props.userTo._id });

    if (recommend === 'no' && report) {
      await api.references.report(this.props.userTo, reportMessage);
    }

    this.setState(() => ({
      isSubmitting: false,
      isSubmitted: true,
      isPublic: savedReference.public
    }));
  }

  render() {
    const { hostedMe, hostedThem, met, recommend, report, reportMessage } = this.state;
    const primaryInteraction = (hostedMe && 'hostedMe') || (hostedThem && 'hostedThem') || 'met';

    const tabs = [
      <Interaction
        key="interaction"
        interactions={{ hostedMe, hostedThem, met }}
        onChange={this.handleChangeInteraction}
      />,
      <Recommend
        key="recommend"
        primaryInteraction={primaryInteraction}
        recommend={recommend}
        report={report}
        reportMessage={reportMessage}
        onChangeRecommend={this.handleChangeRecommend}
        onChangeReport={this.handleChangeReport}
        onChangeReportMessage={this.handleChangeReportMessage}
      />
    ];

    const tabDone = (recommend) ? 1 : (hostedMe || hostedThem || met) ? 0 : -1;

    if (this.state.isSelf) return <Self />;

    if (this.state.isLoading) return <Loading />;

    if (this.state.isDuplicate) return <Duplicate userTo={this.props.userTo} />;

    if (this.state.isSubmitted) {
      const isReported = recommend === 'no' && report;
      const isPublic = this.state.isPublic;
      return <Submitted isReported={isReported} isPublic={isPublic} userFrom={this.props.userFrom} userTo={this.props.userTo} />;
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
            disabled
          >{tabs[0]}</Tab>
          <Tab
            eventKey={1}
            title="Recommendation"
            disabled
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
          onSubmit={this.handleSubmit}
        />
      </div>
    );
  }
}

ReferencesNew.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired
};
