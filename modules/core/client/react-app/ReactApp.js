import { RouterProvider } from '@tanstack/react-router';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';

import { createAppRouter } from './routes';

export { defaultNavigate, signout } from './shell-helpers';

export default function ReactApp({ navigate }) {
  const router = useMemo(() => createAppRouter(), []);

  return (
    <RouterProvider context={{ navigateOverride: navigate }} router={router} />
  );
}

ReactApp.propTypes = {
  navigate: PropTypes.func,
};
