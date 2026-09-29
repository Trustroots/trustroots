import React from 'react';

import Board from '@/modules/core/client/components/Board';

export default function ResetPasswordSuccessPage() {
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
          <i className="icon-4x icon-ok" />
          <br />
          <h3>Password successfully reset</h3>
          <p>
            <a href="/">Continue</a>
          </p>
        </div>
      </div>
    </Board>
  );
}
