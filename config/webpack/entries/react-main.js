/* global document, navigator */
import React from 'react';
import { createRoot } from 'react-dom/client';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import './main.less';

importAll(require.context('../../../modules/', true, /\.less$/));

function importAll(r) {
  r.keys().forEach(r);
}

function enableMessageShellServices() {
  enableVisibilityWatching();
  enableFaviconUpdater();
  enableUnreadMessageCountPolling();
}

function render() {
  enableMessageShellServices();
  const root = createRoot(document.getElementById('tr-react-root'));

  root.render(
    React.createElement(
      AppProviders,
      null,
      React.createElement(ReactApp, null),
    ),
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('/push-messaging-sw.js', { scope: '/' });
}
