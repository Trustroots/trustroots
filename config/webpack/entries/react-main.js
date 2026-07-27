/* global document, navigator */
import React from 'react';
import ReactDOM from 'react-dom';

import '@/config/client/i18n';
import ReactApp from '@/modules/core/client/react-app/ReactApp';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';

import './main.less';

importAll(require.context('../../../modules/', true, /\.less$/));

function importAll(r) {
  r.keys().forEach(r);
}

function render() {
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
