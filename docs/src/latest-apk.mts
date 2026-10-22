import {
  releasesApi,
  selectPreview,
  zapstoreRelease,
} from './android-release-metadata.mts';

(() => {
  const status = document.getElementById('latest-apk-status');
  const downloadLink = document.getElementById(
    'latest-apk-link',
  ) as HTMLAnchorElement | null;
  const appsLink = document.getElementById(
    'android-preview-link',
  ) as HTMLAnchorElement | null;
  const updated = document.getElementById('android-preview-updated');
  const time = document.getElementById(
    'android-preview-time',
  ) as HTMLTimeElement | null;

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
      if (appsLink && time && updated) {
        const published = new Date(release.published).toISOString();
        if (version) version.textContent = ` — version ${release.version}`;
        time.dateTime = published;
        time.textContent = published.slice(0, 16).replace('T', ' ');
        appsLink.href = apk.browser_download_url;
        updated.hidden = false;
      }

      if (downloadLink && status) {
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
