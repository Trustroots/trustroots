import React from 'react';
import PropTypes from 'prop-types';

import SiteFooter from '@/modules/core/client/components/SiteFooter.component';

export default function ReactFooter({ variant = 'standard' }) {
  return <SiteFooter variant={variant} photoCredits={{}} />;
}

ReactFooter.propTypes = {
  variant: PropTypes.string,
};
