/* global document */
import React from 'react';
import { createRoot } from 'react-dom/client';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import 'bootstrap/dist/css/bootstrap.min.css';
import './main.less';

// This file is loaded by main.less; do not include it twice in the CSS bundle.
importAll(
  require.context(
    '../../../modules/',
    true,
    /^(?!.*\/bootstrap\/legacy-classes\.less$).*\.less$/,
  ),
);

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

// Future push: register a browser service worker here when reintroducing
// web push (previously /push-messaging-sw.js when fcmSenderId was set).
