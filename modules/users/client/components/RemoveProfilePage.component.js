import React, { useEffect, useState } from 'react';

import Board from '@/modules/core/client/components/Board';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import * as authApi from '@/modules/users/client/api/auth.api';

export default function RemoveProfilePage() {
  const { token } = getCurrentRouteParams();
  const [state, setState] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    async function removeProfile() {
      setState('loading');

      try {
        await authApi.removeProfile(token);

        if (isMounted) {
          setState('success');
        }
      } catch {
        if (isMounted) {
          setState('failure');
        }
      }
    }

    removeProfile();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <Board className="container container-fullscreen" names="bokeh">
      <div className="row">
        <div className="col-xs-12 text-center">
          <img
            className="hidden-xs"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
          />
          <img
            className="visible-xs-inline-block"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="80"
            height="80"
          />
        </div>
      </div>
      <div className="row">
        <div className="col-xs-12 text-center">
          <br />
          <br />

          {state === 'loading' && <LoadingIndicator />}

          {state === 'success' && (
            <div>
              <i className="icon-4x icon-ok" />
              <br />
              <h3>Your profile was removed.</h3>
              <p className="lead">
                <br />
                <a href="/support">Give us feedback</a>; it&apos;s extremely
                valuable to us!
              </p>
            </div>
          )}

          {state === 'failure' && (
            <div role="alert">
              <i className="icon-4x icon-invalid" />
              <br />
              <h3>Something went wrong.</h3>
              <br />
              <br />
              <p className="lead">
                <strong>Your profile was not removed.</strong>
                <br />
                <br />
                Confirmation link might have been expired; they are valid for 24
                hours.
                <br />
                <br />
                <a
                  className="btn btn-primary"
                  href="/profile/edit/account#remove"
                >
                  Get a new confirmation email
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </Board>
  );
}
