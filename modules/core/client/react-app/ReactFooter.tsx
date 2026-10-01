import React from 'react';
import PropTypes from 'prop-types';

import SiteFooter from '@/modules/core/client/components/SiteFooter.component';

type Props = {
  build?: {
    branch?: string;
    committedAt?: string;
    commitUrl?: string;
    shortCommit?: string;
  };
  variant?: string;
};
export default function ReactFooter({ build, variant = 'standard' }: Props) {
  return <SiteFooter build={build} variant={variant} photoCredits={{}} />;
}

ReactFooter.propTypes = {
  build: PropTypes.shape({
    branch: PropTypes.string,
    committedAt: PropTypes.string,
    commitUrl: PropTypes.string,
    shortCommit: PropTypes.string,
  }),
  variant: PropTypes.string,
};
