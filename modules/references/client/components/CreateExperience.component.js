import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Tab, Tabs } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import * as references from '../api/references.api';
import StepNavigation from '@/modules/core/client/components/StepNavigation';
import Interaction from './create-experience/Interaction';
import Recommend from './create-experience/Recommend';
import Feedback from './create-experience/Feedback';
import ExperienceWithSelfInfo from './create-experience/ExperienceWithSelfInfo';
import DuplicateInfo from './create-experience/DuplicateInfo';
import SubmittedInfo from './create-experience/SubmittedInfo';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { createValidator } from '@/modules/core/client/utils/validation';

const api = { references };

export default function CreateExperience({ userFrom, userTo }) {
  const { t } = useTranslation('references');

  const [met, setMet] = useState(false);
  const [hostedThem, setHostedThem] = useState(false);
  const [hostedMe, setHostedMe] = useState(false);
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
      const experience = await api.references.readMine({
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

    const experience = {
      interactions: { met, hostedThem, hostedMe },
      recommend,
      feedbackPublic,
    };

    // save the experience
    const [savedExperience] = await Promise.all([
      api.references.create({ ...experience, userTo: userTo._id }),
      recommend === 'no' && report
        ? api.references.report(userTo, reportMessage)
        : null,
    ]);

    setIsSubmitting(false);
    setIsSubmitted(true);
    setIsPublic(savedExperience.public);
  };

  const primaryInteraction =
    (hostedMe && 'hostedMe') || (hostedThem && 'hostedThem') || 'met';

  const interactionsTab = (
    <Interaction
      key="interaction"
      interactions={{ hostedMe, hostedThem, met }}
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
      title: t('How do you know them'),
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
        ({ hostedMe, hostedThem, met }) => hostedMe || hostedThem || met,
        t('Choose your interaction'),
      ],
    ],
    recommend: [[value => !!value, t('Choose your recommendation')]],
  });
  const errorDict = validate({
    interaction: { hostedMe, hostedThem, met },
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
        id="create-reference-tabs"
      >
        {tabs.map(({ id, component, title }, i) => {
          return (
            <Tab eventKey={i} key={id} title={title} disabled>
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
