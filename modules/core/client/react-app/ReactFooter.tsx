import React from 'react';

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
