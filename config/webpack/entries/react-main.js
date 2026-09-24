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

// main.less already includes the site-owned Bootstrap compatibility styles.
importAll(require.context('../../../modules/', true, /\.less$/));

function importAll(r) {
  r.keys()
    .filter(key => key !== './core/client/less/bootstrap/legacy-classes.less')
    .forEach(r);
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
