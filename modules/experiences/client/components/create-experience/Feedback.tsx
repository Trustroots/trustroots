import React from 'react';
import { useTranslation } from 'react-i18next';
import { match, P } from 'ts-pattern';
import type { ExperienceRecommendation } from '../../../shared/experience';
import { Textarea } from '@trustroots/ui/Textarea';

interface FeedbackProps {
  feedback: string;
  recommend?: ExperienceRecommendation | null;
  report?: boolean;
  onChangeFeedback: (feedback: string) => void;
  maximumLength?: number;
}

export default function Feedback({
  feedback,
  recommend,
  report,
  onChangeFeedback,
  maximumLength = 2000,
}: FeedbackProps) {
  const { t } = useTranslation('experiences') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  /*
   * Functions passing strings to translation fuction for translation scripts
   */
  const getRecommend = (
    recommendCode: ExperienceRecommendation | null | undefined,
    report: boolean | undefined,
  ) =>
    match(recommendCode)
      .with('yes', () => t('Did you enjoy their cooking? singing?'))
      .with('no', () =>
        report
          ? t(
              'Describe what happened and keep sensitive details in your private report.',
            )
          : t('Describe what happened and how it affected you.'),
      )
      .with('unknown', () => t('Did you maybe enjoy their cooking? singing?'))
      .with(P.nullish, () => undefined)
      .exhaustive(() => undefined);

  return (
    <div className="panel panel-default">
      <div className="panel-heading">
        <h4 id="feedback-public-question">
          {
            t(
              'Would you like to describe something about your experience with them?',
            ) as string
          }{' '}
          ({t('Optional') as string})
        </h4>
      </div>
      <div
        className="panel-body"
        role="group"
        aria-labelledby="feedback-public-question"
      >
        <p>{getRecommend(recommend, report) as string | undefined}</p>
        <br />
        <label htmlFor="feedback-message" className="control-label">
          {
            t(
              'Leave your public feedback here. Remember to be respectful of others and restrain from any kind of abusive behaviour.',
            ) as string
          }
        </label>
        <Textarea
          rows={7}
          id="feedback-message"
          onChange={event => onChangeFeedback(event.target.value)}
          value={feedback}
          aria-describedby="feedback-length feedback-visibility"
          aria-invalid={feedback.length > maximumLength}
        />
        <p id="feedback-length" className="help-block">
          {t('{{used}} / {{maximum}} characters', {
            used: feedback.length,
            maximum: maximumLength,
          })}
          {feedback.length > maximumLength && (
            <span role="alert">
              {' '}
              {t('Your feedback is too long. Please shorten it and try again.')}
            </span>
          )}
        </p>
        <span className="help-block" id="feedback-visibility">
          {
            t(
              'Your feedback appears on their profile when the experience becomes public. Leave out private details such as addresses, phone numbers and private messages.',
            ) as string
          }
          <br />
        </span>
      </div>
    </div>
  );
}
