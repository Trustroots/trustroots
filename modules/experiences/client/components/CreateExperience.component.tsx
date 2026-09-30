// External dependencies
import { Tab, Tabs } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import { createValidator } from '@/modules/core/client/utils/validation';
import { readApiError } from '@/modules/users/client/utils/api-error';
import * as supportApi from '@/modules/support/client/api/support.api';
import * as experiencesApi from '../api/experiences.api';
import DuplicateInfo from './create-experience/DuplicateInfo';
import ExperienceWithSelfInfo from './create-experience/ExperienceWithSelfInfo';
import Feedback from './create-experience/Feedback';
import Interaction from './create-experience/Interaction';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import Recommend from './create-experience/Recommend';
import StepNavigation from '@/modules/core/client/components/StepNavigation';
import SubmittedInfo from './create-experience/SubmittedInfo';
import { draftKey, readDraft, saveDraft, removeDraft } from '../utils/draft';
import type {
  Experience,
  ExperienceInteractions,
  ExperienceMine,
  ExperienceRecommendation,
  ExperienceUser,
} from '../experiences.prop-types';

export default function CreateExperience({
  userFrom,
  userTo,
}: {
  userFrom: ExperienceUser;
  userTo: ExperienceUser & { displayName: string };
}) {
  return (
    <ExperienceForm
      key={`${userFrom._id}:${userTo._id}`}
      userFrom={userFrom}
      userTo={userTo}
    />
  );
}

function ExperienceForm({
  userFrom,
  userTo,
}: {
  userFrom: ExperienceUser;
  userTo: ExperienceUser & { displayName: string };
}) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const key = draftKey(userFrom._id, userTo._id);
  const [stored] = useState(() => readDraft(key));
  const [pendingDraft, setPendingDraft] = useState(stored.draft);
  const [storageAvailable, setStorageAvailable] = useState(stored.available);
  const maximumLength =
    window.settings?.limits?.maximumExperienceFeedbackPublicLength ?? 2000;

  const [met, setMet] = useState(false);
  const [host, setHostedThem] = useState(false);
  const [guest, setHostedMe] = useState(false);
  const [recommend, setRecommend] = useState<ExperienceRecommendation | null>(
    null,
  );
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
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [reportError, setReportError] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    if (
      pendingDraft ||
      isLoading ||
      loadError ||
      isDuplicate ||
      isSubmitted ||
      userFrom._id === userTo._id
    )
      return;
    const hasDraft =
      met || host || guest || feedbackPublic || (sharedOnTime && recommend);
    setStorageAvailable(
      hasDraft
        ? saveDraft(key, { met, host, guest, recommend, feedbackPublic })
        : removeDraft(key),
    );
  }, [
    key,
    met,
    host,
    guest,
    recommend,
    feedbackPublic,
    pendingDraft,
    isLoading,
    loadError,
    isDuplicate,
    isSubmitted,
    userFrom._id,
    userTo._id,
    sharedOnTime,
  ]);

  const restoreDraft = () => {
    // This handler is only rendered while a draft is pending.
    const draft = pendingDraft as NonNullable<typeof pendingDraft>;
    setMet(draft.met);
    setHostedThem(draft.host);
    setHostedMe(draft.guest);
    if (sharedOnTime) setRecommend(draft.recommend);
    setFeedbackPublic(draft.feedbackPublic);
    setPendingDraft(null);
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const experience = await experiencesApi.readMine({
          userWith: userTo._id,
        });
        if (experience) {
          const authorId =
            typeof experience.userFrom === 'string'
              ? experience.userFrom
              : experience.userFrom?._id;
          if (authorId === userFrom._id || !!experience.response) {
            removeDraft(key);
            setIsDuplicate(true);
          } else {
            setIsDuplicate(false);
            setSharedOnTime(!experience.public);
            setRecommend('yes');
          }
        }
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userFrom, userTo, loadAttempt, key]);

  const handleChangeInteraction = (
    interactionType: keyof ExperienceInteractions,
  ) => {
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
    }
  };

  const submitReport = async () => {
    setIsReporting(true);
    setReportError(false);
    try {
      await supportApi.reportMember(userTo, reportMessage);
      setIsReported(true);
    } catch {
      setReportError(true);
    } finally {
      setIsReporting(false);
    }
  };

  const handleRetryReport = async () => {
    await submitReport();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    const experience = {
      interactions: { met, host, guest },
      recommend,
      feedbackPublic,
    };

    try {
      let savedExperience: Experience | ExperienceMine | null;
      try {
        savedExperience = await experiencesApi.create({
          ...experience,
          userTo: userTo._id,
        });
      } catch (error) {
        const status = readApiError(error).status;
        if (status && status !== 409 && status < 500) {
          throw error;
        }
        // A previous save may have succeeded even if its response was lost.
        savedExperience = await experiencesApi.readMine({
          userWith: userTo._id,
        });
        const savedAuthorId =
          typeof savedExperience?.userFrom === 'string'
            ? savedExperience.userFrom
            : savedExperience?.userFrom?._id;
        if (!savedExperience || savedAuthorId !== userFrom._id) {
          throw error;
        }
      }
      if (!savedExperience) {
        throw new Error('The experience response was empty.');
      }
      setIsPublic(savedExperience.public);
      removeDraft(key);
      setIsSubmitted(true);
      if (recommend === 'no' && report) {
        void submitReport();
      }
    } catch (error) {
      const apiError = readApiError(error);
      const details = apiError.data.details;
      const feedbackPublicError =
        typeof details === 'object' && details !== null
          ? (details as Record<string, unknown>).feedbackPublic
          : undefined;
      setSubmitError(
        feedbackPublicError === 'toolong'
          ? t('Your feedback is too long. Please shorten it and try again.')
          : t(
              'We could not save your experience. Your text is still here. Please try again.',
            ),
      );
    } finally {
      setIsSubmitting(false);
    }
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
      onChangeFeedback={feedback => {
        setFeedbackPublic(feedback);
        setSubmitError('');
      }}
      maximumLength={maximumLength}
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
        (value: unknown) => {
          const { guest, host, met } = value as ExperienceInteractions;
          return guest || host || met;
        },
        t('Choose your interaction'),
      ],
    ],
    recommend: [[(value: unknown) => !!value, t('Choose your recommendation')]],
  }) as unknown as (values: {
    interaction: ExperienceInteractions;
    recommend: ExperienceRecommendation | null;
  }) => { interaction: string[]; recommend: string[] };
  const errorDict = validate({
    interaction: { guest, host, met },
    recommend,
  });
  // map errors to tabs and find errors relevant for current tab
  const navigationErrors = [errorDict.interaction, errorDict.recommend];
  const currentStepErrors = navigationErrors.slice(0, step + 1).flat();
  // can we continue?
  const isNextStepDisabled =
    isSubmitting ||
    currentStepErrors.length > 0 ||
    (step === tabs.length - 1 && feedbackPublic.length > maximumLength);
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

  if (loadError) {
    return (
      <div className="alert alert-danger" role="alert">
        <p>{t('We could not load the experience form. Please try again.')}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setLoadAttempt(attempt => attempt + 1)}
        >
          {t('Try again')}
        </button>
      </div>
    );
  }

  if (isDuplicate) {
    return <DuplicateInfo username={userTo.username} />;
  }

  if (isSubmitted) {
    return (
      <div>
        <SubmittedInfo
          isPublic={isPublic}
          isReported={isReported}
          name={userTo.displayName}
          username={userTo.username}
        />
        <p role="status">{t('Your experience has been saved.')}</p>
        {isReporting && (
          <p role="status">{t('Sending your private report…')}</p>
        )}
        {reportError && (
          <div className="alert alert-warning" role="alert">
            <p>
              {t(
                'Your experience was saved, but your private report could not be sent. Please try sending the report again.',
              )}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isReporting}
              onClick={handleRetryReport}
            >
              {t('Retry private report')}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (pendingDraft) {
    return (
      <div className="alert alert-info">
        <p>
          {t(
            'You have an unfinished experience saved on this device. Restore it or start again.',
          )}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={restoreDraft}
        >
          {t('Restore draft')}
        </button>{' '}
        <button
          type="button"
          className="btn btn-default"
          onClick={() => {
            setStorageAvailable(removeDraft(key));
            setPendingDraft(null);
          }}
        >
          {t('Discard draft')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p role="status">
        {storageAvailable
          ? t(
              'Unfinished experiences are saved on this device for 7 days. Private reports are not saved on this device.',
            )
          : t(
              'Your browser could not save a draft on this device. Keep this page open until your experience is saved.',
            )}
      </p>
      {isSubmitting && <p role="status">{t('Saving your experience…')}</p>}
      <fieldset disabled={isSubmitting}>
        <Tabs
          activeKey={step}
          variant="pills"
          id="create-experience-tabs"
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
        {submitError && (
          <div className="alert alert-danger" role="alert">
            {submitError}
          </div>
        )}
        <StepNavigation
          currentStep={step}
          numberOfSteps={tabs.length}
          disabled={isNextStepDisabled}
          disabledReason={nextStepError}
          onBack={() => setStep(step => step - 1)}
          onNext={() => setStep(step => step + 1)}
          onSubmit={handleSubmit}
          submitLabel={isSubmitting ? t('Saving…') : t('Save experience')}
        />
      </fieldset>
    </div>
  );
}

CreateExperience.propTypes = {
  userFrom: PropTypes.object.isRequired,
  userTo: PropTypes.object.isRequired,
};
ExperienceForm.propTypes = CreateExperience.propTypes;
