/* global document, window */
(() => {
  const status = document.getElementById('latest-apk-status');
  const downloadLink = document.getElementById('latest-apk-link');
  const appsLink = document.getElementById('android-preview-link');
  const updated = document.getElementById('android-preview-updated');
  const time = document.getElementById('android-preview-time');

  fetch(
    'https://api.github.com/repos/Trustroots/trustroots/releases?per_page=100',
    {
      headers: { Accept: 'application/vnd.github+json' },
    },
  )
    .then(response => {
      if (!response.ok) throw new Error('Release lookup failed');
      return response.json();
    })
    .then(releases => {
      const release = releases
        .filter(
          item =>
            !item.draft &&
            item.prerelease &&
            item.tag_name.startsWith('android-preview-') &&
            item.assets.some(asset => asset.name.endsWith('.apk')),
        )
        .sort(
          (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at),
        )[0];
      const apk = release?.assets.find(asset => asset.name.endsWith('.apk'));
      if (!apk) throw new Error('No signed APK found');

      if (appsLink) {
        const published = new Date(release.published_at).toISOString();
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
      if (updated) {
        updated.textContent = ' — release date currently unavailable';
        updated.hidden = false;
      }
      if (status) {
        status.textContent = 'We could not look up the latest APK just now.';
      }
    });
})();
