import React from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs } from 'react-bootstrap';
import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';
import * as references from '../api/references.api';
import Navigation from './create-reference/Navigation';
import Interaction from './create-reference/Interaction';
import Recommend from './create-reference/Recommend';
import {
  ReferenceToSelfInfo,
  LoadingInfo,
  DuplicateInfo,
  SubmittedInfo,
} from './create-reference/Info';

const api = { references };

export class CreateReference extends React.Component {
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
      isPublic: false,
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
    const reference = await api.references.read({
      userFrom: this.props.userFrom._id,
      userTo: this.props.userTo._id,
    });

    this.setState(() => {
      const newState = { isLoading: false };
      if (reference.length === 1) newState.isDuplicate = true;
      return newState;
    });
  }

  handleTabSwitch(move) {
    this.setState(state => ({
      tab: state.tab + move,
    }));
  }

  handleChangeInteraction(interactionType) {
    this.setState(state => ({ [interactionType]: !state[interactionType] }));
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
    const {
      met,
      hostedThem,
      hostedMe,
      recommend,
      report,
      reportMessage,
    } = this.state;
    const reference = { met, hostedThem, hostedMe, recommend };

    // save the reference
    const [savedReference] = await Promise.all([
      api.references.create({ ...reference, userTo: this.props.userTo._id }),
      recommend === 'no' && report
        ? api.references.report(this.props.userTo, reportMessage)
        : null,
    ]);

    this.setState(() => ({
      isSubmitting: false,
      isSubmitted: true,
      isPublic: savedReference.public,
    }));
  }

  render() {
    const { t } = this.props;
    const {
      hostedMe,
      hostedThem,
      met,
      recommend,
      report,
      reportMessage,
    } = this.state;
    const primaryInteraction =
      (hostedMe && 'hostedMe') || (hostedThem && 'hostedThem') || 'met';

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
      />,
    ];

    const tabDone = recommend ? 1 : hostedMe || hostedThem || met ? 0 : -1;

    if (this.state.isSelf) return <ReferenceToSelfInfo />;

    if (this.state.isLoading) return <LoadingInfo />;

    if (this.state.isDuplicate)
      return <DuplicateInfo userTo={this.props.userTo} />;

    if (this.state.isSubmitted) {
      const isReported = recommend === 'no' && report;
      const isPublic = this.state.isPublic;
      return (
        <SubmittedInfo
          isReported={isReported}
          isPublic={isPublic}
          userFrom={this.props.userFrom}
          userTo={this.props.userTo}
        />
      );
    }

    return (
      <div>
        <Tabs
          activeKey={this.state.tab}
          bsStyle="pills"
          onSelect={() => {}}
          id="create-reference-tabs"
        >
          <Tab eventKey={0} title={t('How do you know them')} disabled>
            {tabs[0]}
          </Tab>
          <Tab eventKey={1} title={t('Recommendation')} disabled>
            {tabs[1]}
          </Tab>
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

CreateReference.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
};

export default withTranslation('reference')(CreateReference);
