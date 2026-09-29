import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

/* istanbul ignore next -- the default browser location is exercised by the browser bundle. */
export function defaultNavigate(
  path: string,
  location: Location = window.location,
) {
  location.replace(path);
}

/* istanbul ignore next -- the default navigation path uses browser navigation. */
export default function OfferRedirectPage({
  navigate = defaultNavigate,
}: {
  navigate?: (path: string) => void;
}) {
  useEffect(() => {
    navigate('/offer/host');
  }, [navigate]);

  return <div aria-hidden="true">Redirecting…</div>;
}

OfferRedirectPage.propTypes = {
  navigate: PropTypes.func,
};
