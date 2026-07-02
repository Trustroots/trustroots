import React from 'react';

import BoardCredits from '@/modules/core/client/components/BoardCredits';

export default function ReactFooter() {
  return (
    <footer
      id="tr-footer"
      role="contentinfo"
      className="container hidden-print hidden-xs"
    >
      <div className="row">
        <div className="col-xs-3">
          <ul className="list-unstyled">
            <li>
              <a href="/volunteering">Volunteering</a>
            </li>
          </ul>
        </div>
        <div className="col-xs-3">
          <ul className="list-unstyled">
            <li>
              <a href="/rules">Rules</a>
            </li>
            <li>
              <a href="/faq">FAQ</a>
            </li>
            <li>
              <a href="/privacy">Privacy</a>
            </li>
            <li itemScope itemType="http://schema.org/Organization">
              <a href="/foundation" itemProp="name">
                Trustroots Foundation
              </a>
              <link itemProp="url" href={window.location.origin} />
              <link
                itemProp="logo"
                href={`${window.location.origin}/img/logo/color.png`}
              />
            </li>
            <li>
              <a href="/contribute">Contribute</a>
            </li>
            <li>
              <a href="/contact">Contact</a>
            </li>
          </ul>
        </div>
        <div className="col-xs-6">
          <BoardCredits photoCredits={{}} />
        </div>
      </div>
    </footer>
  );
}

ReactFooter.propTypes = {};
