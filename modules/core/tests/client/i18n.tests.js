import { loadRtlCSS } from '@/config/client/i18n';

it('loads the RTL stylesheet emitted for the React entry from nested pages', async () => {
  window.history.replaceState({}, '', '/profile/member-one');
  const loaded = loadRtlCSS();
  const stylesheet = document.getElementById('rtl-style');
  try {
    expect(new URL(stylesheet.href).pathname).toBe(
      '/assets/react-main.rtl.css',
    );
    stylesheet.onload();
    await loaded;
  } finally {
    stylesheet.remove();
  }
});
