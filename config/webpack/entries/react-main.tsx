import React from 'react';
import { createRoot } from 'react-dom/client';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

import 'bootstrap/dist/css/bootstrap.min.css';
import '../../client/styles/main.less';

// main.less already includes the site-owned Bootstrap compatibility styles.
interface WebpackRequireContext {
  keys(): string[];
  (key: string): unknown;
}

declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    pattern: RegExp,
  ): WebpackRequireContext;
};

const moduleStyles = require.context('../../../modules/', true, /\.less$/);
importAll(moduleStyles);

function importAll(r: WebpackRequireContext): void {
  r.keys()
    .filter(key => key !== './core/client/less/bootstrap/legacy-classes.less')
    .forEach(r);
}

function enableMessageShellServices(): void {
  enableVisibilityWatching();
  enableFaviconUpdater();
  enableUnreadMessageCountPolling();
}

function render(): void {
  enableMessageShellServices();
  const element = document.getElementById('tr-react-root');
  if (!element) throw new Error('React root element is missing');
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

// Future push: register a browser service worker here when reintroducing
// web push (previously /push-messaging-sw.js when fcmSenderId was set).
