export function signout(event) {
  if (event) {
    event.preventDefault();
  }

  if (window.postMessage) {
    window.postMessage(
      'unAuthenticated',
      `${window.location.protocol}//${window.location.host}`,
    );
  }

  if (window.isNativeMobileApp && window.postMessage) {
    window.postMessage(JSON.stringify({ action: 'unAuthenticated' }));
  }

  window.top.location.href = '/api/auth/signout';
}

export function defaultNavigate(url) {
  window.location.assign(url);
}
