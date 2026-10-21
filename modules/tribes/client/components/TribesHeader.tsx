import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@trustroots/ui';
import Board from '@/modules/core/client/components/Board';

export default function TribesHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useTranslation('circles') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <Board names="tribes-1" className="tribes-header">
      <div className="container">
        <div className="row">
          <div className="col-xs-12 text-center">
            <br />
            <br />
            <h2>{t('Discover circles') as string}</h2>
            <br />
            <p className="lead">
              {
                t(
                  'Joining circles helps you find likeminded Trustroots members.',
                ) as string
              }
            </p>
            {!isLoggedIn && (
              <div>
                <hr className="hr-white hr-xs" />
                <Button as="a" href="/signup" action variant="default">
                  {t('Sign up with Trustroots') as string}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Board>
  );
}
