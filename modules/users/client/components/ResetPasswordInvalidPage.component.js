import React from 'react';

import Board from '@/modules/core/client/components/Board';

export default function ResetPasswordInvalidPage() {
  return (
    <Board
      names="bokeh"
      className="container container-spacer container-fullscreen"
    >
      <div className="row">
        <div className="col-xs-12 text-center">
          <img
            className="hidden-xs"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="120"
            height="120"
            aria-hidden="true"
          />
          <img
            className="visible-xs-inline-block"
            src="/img/tree-color.svg"
            alt="Trustroots"
            width="80"
            height="80"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="row">
        <div className="text-center col-xs-12">
          <br />
          <br />
          <i className="icon-4x icon-invalid" />
          <br />
          <h3>Password reset is invalid</h3>
          <p>Either this reset link has been already used or it has expired.</p>
          <p>
            <a href="/password/forgot">Ask for a new password reset</a>
          </p>
        </div>
      </div>
    </Board>
  );
}
