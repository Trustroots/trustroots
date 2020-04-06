import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import * as references from '../api/references.api';
import StepNavigation from '@/modules/core/client/components/StepNavigation';
import Interaction from './create-reference/Interaction';
import Recommend from './create-reference/Recommend';
import {
  ReferenceToSelfInfo,
  LoadingInfo,
  DuplicateInfo,
  SubmittedInfo,
} from './create-reference/Info';
import { validate } from '@/modules/core/client/utils/validation';

const api = { references };

export default function CreateReference({ userFrom, userTo }) {
  const { t } = useTranslation('reference');

  const [met, setMet] = useState(false);
  const [hostedThem, setHostedThem] = useState(false);
  const [hostedMe, setHostedMe] = useState(false);
  const [recommend, setRecommend] = useState(null);
  const [report, setReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    (async () => {
      const reference = await api.references.read({
        userFrom: userFrom._id,
        userTo: userTo._id,
      });

      if (reference.length === 1) setIsDuplicate(true);
      setIsLoading(false);
    })();
  }, [userFrom, userTo]);

  const handleChangeInteraction = interactionType => {
    switch (interactionType) {
      case 'met':
        setMet(met => !met);
        break;
      case 'hostedThem':
        setHostedThem(hostedThem => !hostedThem);
        break;
      case 'hostedMe':
        setHostedMe(hostedMe => !hostedMe);
        break;
      default:
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const reference = { met, hostedThem, hostedMe, recommend };

    // save the reference
    const [savedReference] = await Promise.all([
      api.references.create({ ...reference, userTo: userTo._id }),
      recommend === 'no' && report
        ? api.references.report(userTo, reportMessage)
        : null,
    ]);

    setIsSubmitting(false);
    setIsSubmitted(true);
    setIsPublic(savedReference.public);
  };

  const primaryInteraction =
    (hostedMe && 'hostedMe') || (hostedThem && 'hostedThem') || 'met';

  const tabs = [
    <Interaction
      key="interaction"
      interactions={{ hostedMe, hostedThem, met }}
      onChange={handleChangeInteraction}
    />,
    <Recommend
      key="recommend"
      primaryInteraction={primaryInteraction}
      recommend={recommend}
      report={report}
      reportMessage={reportMessage}
      onChangeRecommend={recommend => setRecommend(recommend)}
      onChangeReport={() => setReport(report => !report)}
      onChangeReportMessage={message => setReportMessage(message)}
    />,
  ];

  const ruleDict = {
    interaction: [
      [
        ({ hostedMe, hostedThem, met }) => hostedMe || hostedThem || met,
        t('Choose your interaction'),
      ],
    ],
    recommend: [[value => !!value, t('Choose your recommendation')]],
  };

  const valueDict = {
    interaction: { hostedMe, hostedThem, met },
    recommend,
  };

  // find out whether the current tab is valid, and whether we can continue
  const errorDict = validate(ruleDict, valueDict);
  // map errors to tabs and find errors relevant for current tab
  const navigationErrors = [errorDict.interaction, errorDict.recommend];
  const currentStepErrors = navigationErrors.slice(0, step + 1).flat();
  // can we continue?
  const isNextStepDisabled = isSubmitting || currentStepErrors.length > 0;
  // if not, why?
  const nextStepError =
    !isSubmitting && currentStepErrors.find(error => error.trim().length > 0);

  if (userFrom._id === userTo._id) return <ReferenceToSelfInfo />;

  if (isLoading) return <LoadingInfo />;

  if (isDuplicate) return <DuplicateInfo userTo={userTo} />;

  if (isSubmitted) {
    const isReported = recommend === 'no' && report;
    return (
      <SubmittedInfo
        isReported={isReported}
        isPublic={isPublic}
        userFrom={userFrom}
        userTo={userTo}
      />
    );
  }

  return (
    <div>
      <Tabs
        activeKey={step}
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
      <StepNavigation
        currentStep={step}
        numberOfSteps={tabs.length}
        disabled={isNextStepDisabled}
        disabledReason={nextStepError}
        onBack={() => setStep(step => step - 1)}
        onNext={() => setStep(step => step + 1)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

CreateReference.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
};
