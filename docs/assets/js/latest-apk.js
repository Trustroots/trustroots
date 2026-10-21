import {
  releasesApi,
  selectPreview,
  zapstoreRelease,
} from './android-release-metadata.mjs';

/* global document, window */
(() => {
  const status = document.getElementById('latest-apk-status');
  const downloadLink = document.getElementById('latest-apk-link');
  const appsLink = document.getElementById('android-preview-link');
  const updated = document.getElementById('android-preview-updated');
  const time = document.getElementById('android-preview-time');

  const version = document.getElementById('android-preview-version');
  const zapstoreVersion = document.getElementById('android-zapstore-version');

  if (zapstoreVersion) {
    zapstoreRelease()
      .then(release => {
        zapstoreVersion.textContent = ` — version ${release.version}`;
      })
      .catch(() => {});
  }

  fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' } })
    .then(response => {
      if (!response.ok) throw new Error('Release lookup failed');
      return response.json();
    })
    .then(releases => {
      const release = selectPreview(releases);
      const apk = { browser_download_url: release.url, name: release.filename };
      if (appsLink) {
        const published = new Date(release.published).toISOString();
        if (version) version.textContent = ` — version ${release.version}`;
        time.dateTime = published;
        time.textContent = published.slice(0, 16).replace('T', ' ');
        appsLink.href = apk.browser_download_url;
        updated.hidden = false;
      }

      if (downloadLink) {
        downloadLink.href = apk.browser_download_url;
        downloadLink.textContent = `Download ${apk.name}`;
        status.textContent = `Latest signed preview: ${apk.name}`;
        window.location.replace(apk.browser_download_url);
      }
    })
    .catch(() => {
      // Keep the version and date rendered from the verified site snapshot.
      if (status) {
        status.textContent = 'We could not look up the latest APK just now.';
      }
    });
})();
