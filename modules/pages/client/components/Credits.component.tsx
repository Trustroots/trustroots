import React from 'react';
import Board from './PageBoard';

export default function Credits() {
  return (
    <>
      <Board names="mountainforest">
        <div className="container text-center">
          <br />
          <br />
          <h2>Credits</h2>
        </div>
      </Board>
      <section className="container container-spacer">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8">
            <h1>Credits</h1>
            <p className="lead">
              Trustroots is made possible by a community of volunteers and the
              work of many contributors. Thank you to everyone who helps build
              and maintain it.
            </p>
            <h3>Location data</h3>
            <p>
              This product includes GeoLite2 data created by MaxMind, available
              from <a href="https://www.maxmind.com">MaxMind</a>.
            </p>
            <h3>Maps</h3>
            <p>
              Our maps use data from{' '}
              <a href="https://www.openstreetmap.org/copyright">
                OpenStreetMap contributors
              </a>{' '}
              and may use maps from{' '}
              <a href="https://www.mapbox.com/about/maps/">Mapbox</a>.
            </p>
            <h3>Photography</h3>
            <p>
              Thank you to the photographers who share their work with us.
              Individual photo credits appear on the pages where photos are
              used.
            </p>
            <h3>Open source</h3>
            <p>
              Trustroots is built with open-source software. Explore and
              contribute to our{' '}
              <a href="https://github.com/Trustroots/trustroots">source code</a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
