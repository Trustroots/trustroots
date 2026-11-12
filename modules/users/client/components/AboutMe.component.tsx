// External dependencies
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui/Button';
import React, { useEffect, useState } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import {
  plainText,
  plainTextLength,
} from '@/modules/core/client/utils/filters';
import ReadMorePanel from '@/modules/core/client/components/ReadMorePanel';
import { read as readCircles } from '@/modules/tribes/client/api/tribes.api';
import type { UserProfile } from '../types';

interface AboutMeProps {
  profile: Pick<UserProfile, 'description'>;
  isSelf: boolean;
  profileMinimumLength: number;
}

export default function AboutMe({
  profile,
  isSelf,
  profileMinimumLength,
}: AboutMeProps) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const hasHashtags = plainText(profile.description).includes('#');
  const [circleLinks, setCircleLinks] = useState<ReadonlyMap<string, string>>();

  useEffect(() => {
    if (!hasHashtags) return;
    let cancelled = false;
    // A limit of zero requests the complete visible circle directory.
    readCircles({ limit: 0 })
      .then(circles => {
        if (cancelled) return;
        setCircleLinks(
          new Map(
            circles.map(({ slug }) => [
              slug.toLowerCase(),
              `/circles/${encodeURIComponent(slug)}`,
            ]),
          ),
        );
      })
      .catch(() => {
        // Keep the description readable if the circle directory is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [hasHashtags]);

  return (
    <>
      <section className="panel panel-default">
        <header className="panel-heading">{t('About me')}</header>
        <div className="panel-body">
          {profile.description && (
            <ReadMorePanel
              content={profile.description}
              hashtagLinks={circleLinks}
              id="profile-description"
            />
          )}

          {/* If no description, show deep thoughts... */}
          {!profile.description && (
            <blockquote
              aria-label={t(
                'Member has not written description about themself.',
              )}
              className="profile-quote"
            >
              {t('“Everyone is necessarily the hero of their own life story.”')}
            </blockquote>
          )}
        </div>

        {/* User watching their own profile and it's too short */}
        {isSelf &&
          (!profile.description ||
            plainTextLength(profile.description) < profileMinimumLength) && (
            <footer className="panel-footer">
              <p className="lead">
                {t(
                  'Your profile description should be longer so that you can send messages.',
                )}
                <br />
                <br />
                <Button intent="primary" render={<a href="/profile/edit" />}>
                  {t('Fill your profile')}
                </Button>
              </p>
            </footer>
          )}
      </section>
    </>
  );
}
