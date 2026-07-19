/* global document, navigator */
import React from 'react';
import ReactDOM from 'react-dom';

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
  ReactDOM.render(
    React.createElement(
      AppProviders,
      null,
      React.createElement(ReactApp, null),
    ),
    document.getElementById('tr-react-root'),
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
