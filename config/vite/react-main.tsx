import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { hydrateStart } from '@tanstack/react-start/client';

import '@/config/client/i18n';
import ReactApp from '@/layers/shell/client/ReactApp';
import { AppProviders } from '@/layers/shell/client/AppProviders';
import { routeTemplate } from '@/layers/shell/client/route-options';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import './load-styles';

enableVisibilityWatching();
enableFaviconUpdater();

void hydrateStart().then(router => {
  hydrateRoot(
    document,
    <AppProviders
      queryClient={router.options.context.queryClient}
      routeTemplate={pathname => routeTemplate(router, pathname)}
    >
      <ReactApp router={router} />
    </AppProviders>,
  );
});
