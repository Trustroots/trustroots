import React from 'react';
import WebSocketDemo from '@/modules/core/client/components/WebSocketDemo.js';

export default function Rules() {
  return (
    <>
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <div>
              <WebSocketDemo />
            </div>
          </div>
        </div>
        {/* /.row */}
      </section>
      {/* /.container */}
    </>
  );
}

Rules.propTypes = {};
