import React from 'react';
import { createRoot } from 'react-dom/client';

import '@vitejs/plugin-react/preamble';
import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import './load-styles';

function enableMessageShellServices(): void {
  enableVisibilityWatching();
  enableFaviconUpdater();
  enableUnreadMessageCountPolling();
}

function render(): void {
  enableMessageShellServices();
  const element = document.getElementById('tr-react-root');
  if (!element) {
    throw new Error('React root element is missing');
  }
  const root = createRoot(element);

  root.render(
    <AppProviders>
      <ReactApp />
    </AppProviders>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
