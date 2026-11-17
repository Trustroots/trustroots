import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { hydrateStart } from '@tanstack/react-start/client';

import '@/config/client/i18n';
import ReactApp from '@/layers/shell/client/ReactApp';
import { AppProviders } from '@/layers/shell/client/AppProviders';
import { installUmamiBeforeSend } from '@/modules/core/client/services/umami-before-send';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import './load-styles';

// Install the hook before activating the tracker from the page template.
installUmamiBeforeSend();
enableVisibilityWatching();
enableFaviconUpdater();

void hydrateStart().then(router => {
  hydrateRoot(
    document,
    <AppProviders>
      <ReactApp router={router} />
    </AppProviders>,
  );
});
