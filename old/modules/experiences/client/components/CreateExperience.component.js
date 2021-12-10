// External dependencies
import { Tab, Tabs } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { createValidator } from '@/modules/core/client/utils/validation';
import * as experiencesApi from '../api/experiences.api';
import DuplicateInfo from './create-experience/DuplicateInfo';
import ExperienceWithSelfInfo from './create-experience/ExperienceWithSelfInfo';
import Feedback from './create-experience/Feedback';
import Interaction from './create-experience/Interaction';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import Recommend from './create-experience/Recommend';
import StepNavigation from '@/modules/core/client/components/StepNavigation';
import SubmittedInfo from './create-experience/SubmittedInfo';

export default function CreateExperience({ userFrom, userTo }) {
  const { t } = useTranslation('experiences');

  const [met, setMet] = useState(false);
  const [host, setHostedThem] = useState(false);
  const [guest, setHostedMe] = useState(false);
  const [recommend, setRecommend] = useState(null);
  const [report, setReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [feedbackPublic, setFeedbackPublic] = useState('');
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [sharedOnTime, setSharedOnTime] = useState(true);

  useEffect(() => {
    (async () => {
      const experience = await experiencesApi.readMine({
        userWith: userTo._id,
      });
      if (experience) {
        if (experience.userFrom === userFrom._id || !!experience.response) {
          setIsDuplicate(true);
        } else {
          setIsDuplicate(false);
          setSharedOnTime(!experience.public);
          setRecommend('yes');
        }
      }

      setIsLoading(false);
    })();
  }, [userFrom, userTo]);

  const handleChangeInteraction = interactionType => {
    switch (interactionType) {
      case 'met':
        setMet(met => !met);
        break;
      case 'host':
        setHostedThem(host => !host);
        break;
      case 'guest':
        setHostedMe(guest => !guest);
        break;
      default:
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const experience = {
      interactions: { met, host, guest },
      recommend,
      feedbackPublic,
    };

    // save the experience
    const [savedExperience] = await Promise.all([
      experiencesApi.create({ ...experience, userTo: userTo._id }),
      recommend === 'no' && report
        ? experiencesApi.report(userTo, reportMessage)
        : null,
    ]);

    setIsSubmitting(false);
    setIsSubmitted(true);
    setIsPublic(savedExperience.public);
  };

  const primaryInteraction = (guest && 'guest') || (host && 'host') || 'met';

  const interactionsTab = (
    <Interaction
      key="interaction"
      interactions={{ guest, host, met }}
      onChange={handleChangeInteraction}
    />
  );

  const recommendationTab = (
    <Recommend
      key="recommend"
      primaryInteraction={primaryInteraction}
      recommend={recommend}
      report={report}
      reportMessage={reportMessage}
      onChangeRecommend={recommend => setRecommend(recommend)}
      onChangeReport={() => setReport(report => !report)}
      onChangeReportMessage={message => setReportMessage(message)}
    />
  );

  const feedbackTab = (
    <Feedback
      key="feedback"
      feedback={feedbackPublic}
      recommend={recommend}
      report={report}
      onChangeFeedback={setFeedbackPublic}
    />
  );

  let tabs = [
    {
      id: 'interactions',
      title: t('How do you know them?'),
      component: interactionsTab,
    },
    {
      id: 'recommendation',
      title: t('Recommendation'),
      component: recommendationTab,
    },
    { id: 'feedback', title: t('Feedback'), component: feedbackTab },
  ];

  if (!sharedOnTime) {
    tabs = tabs.filter(elm => elm.component !== recommendationTab);
  }

  // find out whether the current tab is valid, and whether we can continue
  // we'd prefer to create validator outside the render function,
  // but we'd need to translate errors in a very complicated way
  const validate = createValidator({
    interaction: [
      [
        ({ guest, host, met }) => guest || host || met,
        t('Choose your interaction'),
      ],
    ],
    recommend: [[value => !!value, t('Choose your recommendation')]],
  });
  const errorDict = validate({
    interaction: { guest, host, met },
    recommend,
  });
  // map errors to tabs and find errors relevant for current tab
  const navigationErrors = [errorDict.interaction, errorDict.recommend];
  const currentStepErrors = navigationErrors.slice(0, step + 1).flat();
  // can we continue?
  const isNextStepDisabled = isSubmitting || currentStepErrors.length > 0;
  // if not, why?
  const nextStepError = isSubmitting
    ? ''
    : currentStepErrors.find(error => error.trim().length > 0);

  if (userFrom._id === userTo._id) {
    return <ExperienceWithSelfInfo />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isDuplicate) {
    return <DuplicateInfo username={userTo.username} />;
  }

  if (isSubmitted) {
    const isReported = recommend === 'no' && report;
    return (
      <SubmittedInfo
        isPublic={isPublic}
        isReported={isReported}
        name={userTo.displayName}
        username={userTo.username}
      />
    );
  }

  return (
    <div>
      <Tabs
        activeKey={step}
        bsStyle="pills"
        onSelect={() => {}}
        className="create-experience-tabs"
      >
        {tabs.map(({ id, component, title }, i) => {
          return (
            <Tab disabled eventKey={i} key={id} title={title}>
              {component}
            </Tab>
          );
        })}
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

CreateExperience.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
};
