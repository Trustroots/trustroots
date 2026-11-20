import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';

import { read } from '../api/experiences.api';
import Experience from './read-experiences/Experience';

export default function PendingAuthoredExperiences({
  userId,
}: {
  userId: string;
}) {
  const { t } = useTranslation('experiences');
  const { data, isError, refetch } = useQuery({
    queryKey: ['pending-authored-experiences', userId],
    queryFn: () => read({ userTo: userId, view: 'pending-authored' }),
    retry: false,
  });

  if (isError) {
    return (
      <p role="alert">
        {t('Could not load the experiences you shared that are still private.')}{' '}
        <Button size="sm" onClick={() => void refetch()}>
          {t('Try again')}
        </Button>
      </p>
    );
  }
  if (!data?.length) return null;

  return (
    <section aria-labelledby="pending-authored-experiences-heading">
      <h3 id="pending-authored-experiences-heading">
        {t('Experiences you shared that are still private')}
      </h3>
      {[...data].reverse().map(experience => (
        <Experience
          key={experience._id}
          experience={experience}
          onReceiverProfile={false}
          showPendingRecipient
        />
      ))}
    </section>
  );
}
