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

export function navigateTo(url, location = window.location) {
  if (typeof location.assign === 'function') {
    location.assign(url);
    return;
  }

  location.href = url;
}

export const navigation = {
  go(url) {
    navigateTo(url);
  },
};

export function defaultNavigate(url) {
  navigation.go(url);
}
