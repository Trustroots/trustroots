import { loadRtlCSS } from '@/config/client/i18n';

it('loads the RTL stylesheet emitted for the React entry from nested pages', async () => {
  window.history.replaceState({}, '', '/profile/member-one');
  const loaded = loadRtlCSS();
  const stylesheet = document.getElementById('rtl-style') as HTMLLinkElement;
  try {
    expect(new URL(stylesheet.href).pathname).toBe(
      '/assets/react-main.rtl.css',
    );
    if (!stylesheet.onload) {
      throw new Error('Expected the RTL stylesheet load handler');
    }
    stylesheet.onload(new Event('load'));
    await loaded;
  } finally {
    stylesheet.remove();
  }
});
