import React from 'react';

import ActivateProfileNotice from '@/modules/users/client/components/ActivateProfileNotice.component';

export default function OfferShell({
  children,
  user,
}: {
  children?: React.ReactNode;
  user?: { public?: boolean } | null;
}) {
  return (
    <section className="tw:page-container container-spacer offer">
      {!user?.public && <ActivateProfileNotice />}
      {user?.public && children}
    </section>
  );
}
