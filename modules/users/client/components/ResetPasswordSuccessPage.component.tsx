import React from 'react';

import Board from '@/modules/core/client/components/Board';

export default function ResetPasswordSuccessPage() {
  return (
    <Board
      names="bokeh"
      className="tw:page-container container-spacer container-fullscreen"
    >
      <div className="tw:grid-row">
        <div className="tw:grid-col-12 text-center">
          <img
            className="tw:max-sm:hidden"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
            aria-hidden="true"
          />
          <img
            className="tw:inline-block tw:sm:hidden"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="80"
            height="80"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="tw:grid-row">
        <div className="text-center tw:grid-col-12">
          <br />
          <br />
          <i className="icon-4x icon-ok" />
          <br />
          <h3>Password successfully reset</h3>
          <p>
            Sign in with your new password and authenticator code to continue.
          </p>
          <p>
            <a href="/signin">Sign in</a>
          </p>
        </div>
      </div>
    </Board>
  );
}
