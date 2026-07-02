const REACT_OWNED_PATHS = [
  '/contact',
  '/contribute',
  '/faq',
  '/faq/bugs-and-features',
  '/faq/circles',
  '/faq/foundation',
  '/faq/technology',
  '/foundation',
  '/guide',
  '/media',
  '/privacy',
  '/rules',
  '/statistics',
  '/support',
  '/team',
  '/volunteering',
];

function normalizePath(path) {
  const parsedPath = (path || '/').split('?')[0].split('#')[0] || '/';

  if (parsedPath.length > 1 && parsedPath.endsWith('/')) {
    return parsedPath.slice(0, -1);
  }

  return parsedPath;
}

function isReactOwnedPath(path) {
  return REACT_OWNED_PATHS.includes(normalizePath(path));
}

module.exports = {
  REACT_OWNED_PATHS,
  isReactOwnedPath,
  normalizePath,
};
