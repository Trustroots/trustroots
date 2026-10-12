import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import type { PageTranslator, PageUser } from '../types';
import { getGreeters, type Greeter } from '../api/greeters.api';

export default function Greeters({ user }: { user?: PageUser | null }) {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;
  const [greeters, setGreeters] = useState<Greeter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    getGreeters()
      .then(({ greeters }) => {
        if (isCurrent) setGreeters(greeters);
      })
      .catch(() => {
        if (isCurrent) setHasError(true);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="container container-spacer">
      <div className="row">
        <div className="col-xs-12 col-sm-8 col-sm-offset-2 text-center">
          <h1>{t('Trustroots greeters')}</h1>
          <p className="lead">
            {t(
              'Greeters welcome new members and help them get started in the Trustroots community.',
            )}
          </p>
          <p>
            <a href="/team">{t('Meet the Trustroots team')}</a>
          </p>
          <hr />
        </div>
      </div>

      <div className="row">
        <div className="col-xs-12">
          {isLoading && <LoadingIndicator />}
          {hasError && (
            <p className="text-center" role="alert">
              {t('Greeters could not be loaded. Please try again later.')}
            </p>
          )}
          {!isLoading && !hasError && greeters.length === 0 && (
            <p className="text-center">{t('No greeters to show right now.')}</p>
          )}
          {!hasError && greeters.length > 0 && (
            <div className="team-volunteers">
              {greeters.map(({ _id, username, displayName }) => (
                <div className="team-volunteer" key={_id}>
                  <a href={`/profile/${username}`}>
                    <img
                      alt={displayName || username}
                      className="img-circle"
                      src={
                        user
                          ? `/api/users/${_id}/avatar?size=256`
                          : '/img/avatar.png'
                      }
                    />
                    <h4>{displayName || username}</h4>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <hr />
      <div className="row">
        <div className="col-xs-12 text-center">
          <h2>{t('Want to join the greeters?')}</h2>
          <p>
            <a
              className="btn btn-lg btn-primary"
              href="/support?category=volunteering"
            >
              {t('Want to join?')}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
