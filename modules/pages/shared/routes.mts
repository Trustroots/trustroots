import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const PAGES_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/', title: 'Home', footerHidden: true },
  { path: '/about', title: 'About', footerHidden: true, redirectTo: '/' },
  { path: '/contribute', title: 'Contribute' },
  { path: '/credits', title: 'Credits' },
  { path: '/faq', title: 'FAQ - Site & community' },
  { path: '/faq/bugs-and-features', title: 'FAQ - Bugs & Features' },
  { path: '/faq/circles', title: 'FAQ - Circles' },
  { path: '/faq/foundation', title: 'FAQ - Foundation' },
  { path: '/faq/technology', title: 'FAQ - Technology' },
  { path: '/foundation', title: 'Foundation' },
  { path: '/guide', title: 'Guide' },
  { path: '/media', title: 'Media' },
  {
    path: '/navigation',
    title: 'Navigation',
    requiresAuth: true,
    footerHidden: true,
  },
  { path: '/privacy', title: 'Privacy policy' },
  { path: '/rules', title: 'Rules' },
  { path: '/safety', title: 'Safety' },
  { path: '/team', title: 'Team' },
  { path: '/team/greeters', title: 'Trustroots greeters' },
  { path: '/volunteering', title: 'Volunteering' },
];
