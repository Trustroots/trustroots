/**
 * Shared navigation link registry for the website and the native Android app.
 *
 * The JSON file next to this module is the single source of truth for the
 * Info and support link labels, URLs and ordering, and for the
 * profile-experiences URL pattern. The Android app mirrors it in
 * `apps/android/app/src/main/java/org/trustroots/android/ui/SharedNavigationLinks.kt`,
 * which a unit test keeps in sync with the JSON.
 *
 * `href` values are what the website renders: root-relative paths for
 * Trustroots pages and absolute URLs for external sites. Native apps resolve
 * root-relative paths against `siteUrl`.
 */
import registry from './navigation-links.json';

export type InfoAndSupportLink = {
  id: string;
  label: string;
  href: string;
  opensInNewTab?: boolean;
};

export const siteUrl: string = registry.siteUrl;

export const infoAndSupportHeading: string = registry.infoAndSupport.heading;

export const infoAndSupportLinks: InfoAndSupportLink[] =
  registry.infoAndSupport.items;

export const profileExperiencesPathPattern: string =
  registry.profileExperiencesPath;

/**
 * Build the path where a member shares a new experience for another member.
 * The username is interpolated verbatim to match the website's route.
 */
export function getProfileExperiencesPath(username: string): string {
  return profileExperiencesPathPattern.replace('{username}', username);
}
