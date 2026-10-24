export function getBootstrapData() {
  return {
    env: window.env || 'production',
    isNativeMobileApp: Boolean(window.isNativeMobileApp),
    settings: {
      ...(window.settings || {}),
      flashTimeout: window.settings?.flashTimeout || 6000,
    },
    title: window.title || 'Trustroots',
    user: window.user || null,
  };
}
