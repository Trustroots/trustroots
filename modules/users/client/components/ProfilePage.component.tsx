import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from '@tanstack/react-router';
import { Button } from '@trustroots/ui/Button';
import { getAdminUserHref } from '@/modules/admin/client/utils/member-url';
import { useTranslation } from 'react-i18next';

import AboutMe from './AboutMe.component';
import ProfileCompletionReminders from './ProfileCompletionReminders.component';
import AvatarNameMobile from './AvatarNameMobile.component';
import MemberIdentity from './MemberIdentity';
import BlockedMemberBanner from './BlockedMemberBanner.component';
import BlockMember from './BlockMember.component';
import BottomNavigationSmall from './BottomNavigationSmall.component';
import ConfirmEmailNotification from './ConfirmEmailNotification.component';
import MembershipsList from './MembershipsList.component';
import ProfileOverview from './ProfileOverview.component';
import ProfileTabs from './ProfileTabs.component';
import ProfileTribesTab from './ProfileTribesTab.component';
import TopNavigationSmall from './TopNavigationSmall.component';
import TribesInCommon from './TribesInCommon.component';
import UserDoesNotExist from './UserDoesNotExist.component';
import { profileQuery } from '../api/profile-queries';
import {
  getMobileProfileRedirect,
  getProfileViewTab,
  getProfileViewTabStateName,
} from '../utils/profile-routes';
import { getProfileExperiencesPath } from '@trustroots/core/navigation-links';
import {
  rememberOutreachSource,
  useAnalytics,
} from '@trustroots/analytics/client';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/app-context';
import ContactList from '@/modules/contacts/client/components/ContactList.component';
import YourConnection from '@/modules/contacts/client/components/YourConnection';
import RemoveContactContainer from '@/modules/contacts/client/components/RemoveContactContainer';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';
import ListExperiences, {
  type ExperienceAction,
} from '@/modules/experiences/client/components/ListExperiences.component';
import { readMine } from '@/modules/experiences/client/api/experiences.api';
import PendingAuthoredExperiences from '@/modules/experiences/client/components/PendingAuthoredExperiences';
import Experience from '@/modules/experiences/client/components/read-experiences/Experience';
import Offers from '@/modules/offers/client/components/Offers.component';
import ContactsCommon from '@/modules/contacts/client/components/ContactsCommon.component';
import ReportMember from '@/modules/core/client/components/ReportMember.component';
import { Tooltip } from '@trustroots/ui/Tooltip';
import type {
  ContactList as ContactListData,
  ContactListEntry,
  ContactRecord,
} from '@/modules/contacts/client/types';
import type { UserProfile } from '../types';

interface ResolvedUserProfile extends UserProfile {
  $resolved?: boolean;
}

type ContactState = ContactRecord & { $resolved: boolean };

function resolvedContactList(
  contacts: ContactListEntry[] | undefined,
): ContactListData {
  const entries = contacts ?? [];
  return Object.assign([...entries], {
    $resolved: true,
    length: entries.length,
  });
}

async function loadContactList(profileId: string) {
  return contactsApi.list(profileId).then(
    contacts => ({ contacts: resolvedContactList(contacts), failed: false }),
    () => ({ contacts: resolvedContactList([]), failed: true }),
  );
}

function normalizeContact(contact: ContactRecord | null): ContactState {
  if (!contact) {
    return { $resolved: true };
  }

  const normalized: ContactState = { ...contact, $resolved: true };

  if (typeof normalized.userFrom === 'object') {
    normalized.userFrom = normalized.userFrom._id;
  }

  if (typeof normalized.userTo === 'object') {
    normalized.userTo = normalized.userTo._id;
  }

  return normalized;
}

function ProfileAboutTab({
  authUser,
  contacts,
  isSelf,
  profile,
  profileMinimumLength,
}: {
  authUser: UserProfile;
  contacts: ContactListData;
  isSelf: boolean;
  profile: ResolvedUserProfile;
  profileMinimumLength: number;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const showContactsCommon =
    profile._id !== authUser._id && (contacts?.length || 0) > 0;
  const showCircles = isSelf || (profile.member && profile.member.length > 0);

  return (
    <div className="tw:grid-row">
      <div className="tw:md:grid-col-6">
        <AboutMe
          isSelf={isSelf}
          profile={profile}
          profileMinimumLength={profileMinimumLength}
        />
      </div>
      <div className="tw:md:grid-col-6">
        <div className="tw:max-sm:hidden">
          <Offers authUser={authUser} profile={profile} />
        </div>
        {showContactsCommon && <ContactsCommon profileId={profile._id} />}
        {showCircles && (
          <section className="panel panel-default">
            <header className="panel-heading">{t('Circles') as string}</header>
            <div className="panel-body">
              {!isSelf && (
                <TribesInCommon
                  memberIds={authUser.memberIds || []}
                  memberships={profile.member}
                />
              )}
              <MembershipsList
                isOwnProfile={isSelf}
                memberships={profile.member}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProfileDesktopActions({
  isAdmin,
  isSelf,
  contact,
  contactResolved,
  onRemoveClick,
  profile,
  experienceAction,
}: {
  isAdmin: boolean;
  isSelf: boolean;
  contact: ContactState;
  contactResolved: boolean;
  onRemoveClick: () => void;
  profile: ResolvedUserProfile;
  experienceAction?: ExperienceAction;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  return (
    <ul className="nav nav-pills nav-narrow profile-actions" role="navigation">
      {!isSelf && (
        <>
          <li>
            <Button
              variant="link"
              render={
                <a
                  href={`/messages/${profile.username}`}
                  onClick={() =>
                    rememberOutreachSource(profile.username, 'profile')
                  }
                />
              }
            >
              <i className="fa icon-message-alt" />
              {t('Send a message') as string}
            </Button>
          </li>
          {experienceAction && (
            <li>
              <Button
                variant="link"
                render={<a href={experienceAction.href} />}
              >
                {experienceAction.label}
              </Button>
            </li>
          )}
          <li>
            {contactResolved && !contact._id && (
              <Button
                variant="link"
                render={
                  <a
                    href={`/contact-add/${profile._id}`}
                    onClick={() =>
                      rememberOutreachSource(profile.username, 'profile')
                    }
                  />
                }
              >
                <i className="icon-plus-squared-alt" />
                {t('Add contact') as string}
              </Button>
            )}
            {contactResolved && contact._id && (
              <Tooltip
                tooltip={
                  contact.confirmed
                    ? (t('Contacts since {{date, LL}}', {
                        date: new Date(contact.created || ''),
                      }) as string)
                    : (t('Request sent {{date, LL}}', {
                        date: new Date(contact.created || ''),
                      }) as string)
                }
                placement="bottom"
              >
                <Button variant="link" type="button" onClick={onRemoveClick}>
                  <i className="icon-minus-squared-alt" />
                  {contact.confirmed
                    ? (t('Remove contact') as string)
                    : (t('Delete contact request') as string)}
                </Button>
              </Tooltip>
            )}
          </li>
        </>
      )}
      {isAdmin && (
        <li>
          <Button
            variant="link"
            render={<a href={getAdminUserHref(profile)} />}
          >
            <i className="icon-cog" aria-hidden="true" />
            Admin
          </Button>
        </li>
      )}
    </ul>
  );
}

export default function ProfilePage({
  embedded = false,
  profileUsername,
  user: authUser,
}: {
  embedded?: boolean;
  profileUsername?: string;
  user: UserProfile;
}) {
  const { t } = useTranslation('users') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { setUser } = useAuth() as { setUser: (user: UserProfile) => void };
  const { track } = useAnalytics();
  const viewedProfileId = useRef<string | null>(null);
  const contactsRequestVersion = useRef(0);
  const browserPath = useLocation({ select: location => location.pathname });
  const routeParams = useParams({ strict: false });
  const username = profileUsername || routeParams.username;
  // An embedded profile always shows its About tab, wherever it is embedded.
  const currentPath = embedded
    ? `/profile/${encodeURIComponent(username)}`
    : browserPath;
  const { profileMinimumLength = 140, referencesEnabled = false } =
    useSettings();

  const [contact, setContact] = useState<ContactState>({ $resolved: false });
  const [contacts, setContacts] = useState<ContactListData>(
    Object.assign([], { $resolved: false }),
  );
  const [contactsLoadFailed, setContactsLoadFailed] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const tab = getProfileViewTab(currentPath, username);
  const activePathName = getProfileViewTabStateName(currentPath, username);
  const canLoadReply = referencesEnabled && !embedded;
  const isCreatingExperience = tab === 'experiences-new';
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(
    profileQuery(username, { canLoadReply, viewerId: authUser?._id }),
  );
  const wasCreatingExperience = useRef(isCreatingExperience);
  useEffect(() => {
    // Leaving the experience form may have saved one, so read the profile again.
    if (wasCreatingExperience.current && !isCreatingExperience) {
      void queryClient.invalidateQueries({ queryKey: ['profile', username] });
    }
    wasCreatingExperience.current = isCreatingExperience;
  }, [isCreatingExperience, queryClient, username]);
  const experienceOnly = Boolean(data?.experienceOnly);
  const ownExperience = data?.ownExperience;
  const profile = useMemo<ResolvedUserProfile | null>(() => {
    if (isPending) return null;
    return data?.profile?._id
      ? { ...data.profile, $resolved: true }
      : { _id: '', username: '', displayName: '', $resolved: true };
  }, [data, isPending]);
  const isSelf = profile?._id === authUser?._id;
  const viewedMemberId = profile?._id || '';
  const profileUsernameForAction = profile?.username || username;
  const canCheckSharedExperience =
    canLoadReply &&
    !experienceOnly &&
    !isCreatingExperience &&
    Boolean(viewedMemberId) &&
    !isSelf;
  const sharedExperience = useQuery({
    queryKey: [
      'profile',
      username,
      'shared-experience',
      authUser._id,
      viewedMemberId,
    ],
    enabled: canCheckSharedExperience,
    queryFn: async () => {
      const experience = await readMine({ userWith: viewedMemberId });
      if (!experience) return null;
      const author = experience.userFrom;
      const authorId = typeof author === 'string' ? author : author._id;
      return authorId === authUser._id ? experience._id : null;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const experienceAction = useMemo<ExperienceAction | undefined>(() => {
    if (
      !referencesEnabled ||
      !viewedMemberId ||
      isSelf ||
      isCreatingExperience ||
      (canCheckSharedExperience &&
        (sharedExperience.isPending || sharedExperience.isFetching))
    ) {
      return undefined;
    }
    if (sharedExperience.data) {
      return {
        label: t('View your experience'),
        href: `/profile/${profileUsernameForAction}/experiences#${sharedExperience.data}`,
      };
    }
    return {
      label: t('Share your experience'),
      href: getProfileExperiencesPath(profileUsernameForAction),
    };
  }, [
    canCheckSharedExperience,
    isCreatingExperience,
    isSelf,
    profileUsernameForAction,
    referencesEnabled,
    sharedExperience.data,
    sharedExperience.isFetching,
    sharedExperience.isPending,
    t,
    viewedMemberId,
  ]);
  const isLoading =
    isPending || Boolean(profile?._id && !experienceOnly && !contact.$resolved);

  const removeContact = useCallback((removedContact: ContactRecord) => {
    setContacts(previousContacts => {
      const nextContacts = [...previousContacts];
      const index = nextContacts.findIndex(
        item => item._id === removedContact._id,
      );

      if (index !== -1) {
        nextContacts.splice(index, 1);
      }

      return Object.assign(nextContacts, {
        $resolved: true,
        length: nextContacts.length,
      });
    });

    setContact(previousContact => {
      if (previousContact?._id !== removedContact._id) {
        return previousContact;
      }

      return { $resolved: true };
    });
  }, []);

  async function retryContacts(profileId: string) {
    const requestVersion = ++contactsRequestVersion.current;
    setContactsLoadFailed(false);
    setContacts(Object.assign([], { $resolved: false }));
    const result = await loadContactList(profileId);
    if (requestVersion !== contactsRequestVersion.current) return;
    setContacts(result.contacts);
    setContactsLoadFailed(result.failed);
  }

  useEffect(() => {
    if (embedded) {
      return;
    }

    const redirectPath = getMobileProfileRedirect(currentPath, username);

    if (redirectPath && redirectPath !== currentPath) {
      window.location.assign(redirectPath);
    }
  }, [currentPath, embedded, username]);

  useEffect(() => {
    const profileId = profile?._id;
    contactsRequestVersion.current++;
    setContact({ $resolved: false });
    setContacts(Object.assign([], { $resolved: false }));
    setContactsLoadFailed(false);
    if (!profileId || experienceOnly) {
      return undefined;
    }

    let isMounted = true;
    const viewingOwnProfile = profileId === authUser?._id;
    // Count each profile once while this page stays mounted.
    if (viewedProfileId.current !== profileId) {
      viewedProfileId.current = profileId;
      track('profile_viewed', { own: viewingOwnProfile ? 'yes' : 'no' });
    }
    void Promise.all([
      viewingOwnProfile || !authUser?._id
        ? Promise.resolve(null)
        : contactsApi.getByUserId(profileId).catch(() => null),
      loadContactList(profileId),
    ]).then(([loadedContact, loadedContactsResult]) => {
      if (!isMounted) {
        return;
      }
      setContact(normalizeContact(loadedContact));
      setContactsLoadFailed(loadedContactsResult.failed);
      setContacts(loadedContactsResult.contacts);
    });

    return () => {
      isMounted = false;
      contactsRequestVersion.current++;
    };
  }, [profile?._id, experienceOnly, authUser?._id]);

  const handleMembershipUpdated = (data: { user?: UserProfile } | null) => {
    if (data?.user) {
      setUser(data.user);
    }
  };

  const tabContent = useMemo(() => {
    if (!profile?._id) {
      return null;
    }

    switch (tab) {
      case 'overview':
        return (
          <>
            <AvatarNameMobile profile={profile} isSelf={isSelf} />
            <ProfileOverview
              profile={profile}
              isSelf={isSelf}
              canOpenCouchsurfing={Boolean(authUser.extSitesCS?.trim())}
            />
            {!isSelf && (
              <div className="profile-flags">
                <ReportMember username={profile.username} />
                <br />
                <br />
                <BlockMember
                  isBlocked={authUser.blocked?.includes(profile._id) === true}
                  username={profile.username}
                />
              </div>
            )}
          </>
        );
      case 'accommodation':
        return <Offers authUser={authUser} profile={profile} />;
      case 'contacts':
        return (
          <ContactList
            appUser={authUser}
            contacts={contacts}
            onContactRemoved={removeContact}
            loadFailed={contactsLoadFailed}
            onRetry={() => retryContacts(profile._id)}
          />
        );
      case 'tribes':
        return (
          <ProfileTribesTab
            memberships={
              /* istanbul ignore next -- public profile records always provide membership arrays. */
              profile.member || []
            }
            onMembershipUpdated={handleMembershipUpdated}
            user={authUser}
          />
        );
      case 'experiences':
        return referencesEnabled ? (
          <>
            {isSelf && <PendingAuthoredExperiences userId={profile._id} />}
            <ListExperiences
              authenticatedUser={authUser}
              profile={profile}
              experienceAction={experienceAction}
            />
          </>
        ) : null;
      case 'experiences-new':
        return referencesEnabled ? (
          <CreateExperience userFrom={authUser} userTo={profile} />
        ) : null;
      case 'about':
      default:
        return (
          <ProfileAboutTab
            authUser={authUser}
            contacts={contacts}
            isSelf={isSelf}
            profile={profile}
            profileMinimumLength={profileMinimumLength}
          />
        );
    }
  }, [
    authUser,
    contacts,
    experienceAction,
    isSelf,
    profile,
    profileMinimumLength,
    referencesEnabled,
    removeContact,
    tab,
  ]);

  const pendingIncomingContact =
    contact.$resolved &&
    contact._id &&
    !contact.confirmed &&
    contact.userTo === authUser._id;

  if (experienceOnly && !isLoading && profile && canLoadReply) {
    return (
      <section className="tw:page-container container-spacer">
        <MemberIdentity user={profile} size={64} heading />
        <ReportMember username={profile.username} />
        {isCreatingExperience ? (
          <CreateExperience userFrom={authUser} userTo={profile} />
        ) : ownExperience ? (
          <Experience
            experience={{
              ...ownExperience,
              userFrom: { _id: authUser._id, username: authUser.username },
              userTo: profile,
              response: null,
            }}
            onReceiverProfile={false}
          />
        ) : (
          <p>
            <a href={getProfileExperiencesPath(profile.username)}>
              {t('Share your experience') as string}
            </a>
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      {!embedded && (
        <TopNavigationSmall
          isAdmin={authUser.roles?.includes('admin') || false}
          contact={contact}
          isResolved={contact.$resolved}
          onContactRemoved={removeContact}
          experienceAction={experienceAction}
          selfId={authUser._id}
          userId={profile?._id || ''}
          username={profile?.username || username}
        />
      )}
      {!embedded && (
        <BottomNavigationSmall
          contactCount={contacts.length || 0}
          isSelf={isSelf}
          username={profile?.username || username}
        />
      )}

      <section
        className={
          embedded
            ? 'container-spacer profile-view profile-view-embedded'
            : 'tw:page-container container-spacer profile-view'
        }
      >
        {profile && (authUser.blocked || []).includes(profile._id) && (
          <BlockedMemberBanner username={profile.username} />
        )}

        {isLoading && (
          <div
            className="tw:grid-row content-wait"
            role="alertdialog"
            aria-busy="true"
            aria-live="assertive"
          >
            <small>{t('Wait a moment…') as string}</small>
          </div>
        )}

        {!isLoading &&
          profile?.$resolved &&
          !profile.username &&
          authUser.public !== false && <UserDoesNotExist />}

        {!isLoading &&
          profile?.$resolved &&
          isSelf &&
          authUser.public === false && <ConfirmEmailNotification />}

        {!isLoading && profile?.username && profile.$resolved && (
          <>
            {isSelf && <ProfileCompletionReminders profile={profile} />}
            {tab !== 'experiences' && tab !== 'experiences-new' && (
              <YourConnection
                viewer={authUser}
                member={profile}
                contactRefreshKey={contact._id}
                onContactRemoved={removeContact}
              />
            )}
            {pendingIncomingContact && (
              <div
                className="tw:grid-row"
                role="alertdialog"
                aria-labelledby="confirmContactDialogLabel"
              >
                <div className="tw:grid-col-12 text-center">
                  <ul className="list-inline">
                    <li id="confirmContactDialogLabel">
                      <strong>{profile.displayName}</strong>{' '}
                      {t('sent you a contact request') as string}
                    </li>
                    <li>
                      <Button
                        intent="primary"
                        size="sm"
                        render={<a href={`/contact-confirm/${contact._id}`} />}
                      >
                        {t('Confirm Request') as string}
                      </Button>
                    </li>
                    <li>
                      <Button
                        intent="danger"
                        size="sm"
                        type="button"
                        onClick={() => setShowRemoveModal(true)}
                      >
                        {t('Decline Request') as string}
                      </Button>
                    </li>
                  </ul>
                  <hr />
                </div>
              </div>
            )}

            <div className="tw:grid-row">
              {tab === 'overview' ? (
                <div className="tw:sm:grid-col-12">{tabContent}</div>
              ) : (
                <>
                  <div className="tw:sm:grid-col-3 tw:max-sm:hidden">
                    <ProfileOverview
                      profile={profile}
                      isSelf={isSelf}
                      canOpenCouchsurfing={Boolean(authUser.extSitesCS?.trim())}
                    />
                    {!isSelf && (
                      <div className="profile-flags">
                        <ReportMember username={profile.username} />
                        <br />
                        <br />
                        <BlockMember
                          isBlocked={(authUser.blocked || []).includes(
                            profile._id,
                          )}
                          username={profile.username}
                        />
                      </div>
                    )}
                  </div>
                  <div className="tw:sm:grid-col-9">
                    <div className="tw:grid-row tw:max-sm:hidden">
                      <div className="tw:grid-col-12">
                        <div className="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3">
                          <MemberIdentity
                            user={profile}
                            size={64}
                            className="tw:text-xl"
                            heading
                          />
                          {isSelf && (
                            <Button
                              intent="primary"
                              render={<a href="/profile/edit" />}
                            >
                              {t('Edit your profile') as string}
                            </Button>
                          )}
                        </div>
                        {profile.tagline && (
                          <div className="profile-tagline">
                            {profile.tagline}
                          </div>
                        )}
                      </div>
                    </div>

                    {(!isSelf || authUser.roles?.includes('admin')) && (
                      <div className="tw:grid-row tw:max-sm:hidden">
                        <div className="tw:grid-col-12">
                          <ProfileDesktopActions
                            isAdmin={authUser.roles?.includes('admin') || false}
                            isSelf={isSelf}
                            contact={contact}
                            contactResolved={contact.$resolved}
                            onRemoveClick={() => setShowRemoveModal(true)}
                            profile={profile}
                            experienceAction={experienceAction}
                          />
                        </div>
                      </div>
                    )}

                    <div className="tw:grid-row">
                      <div className="tw:grid-col-12">
                        <ProfileTabs
                          activePathName={activePathName}
                          contactsCount={contacts.length || 0}
                          initialPathName={activePathName}
                          isExperiencesEnabled={referencesEnabled}
                          isOWnProfile={isSelf}
                          userId={profile._id}
                          username={profile.username}
                        />
                        {tabContent}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {contact._id && (
        <RemoveContactContainer
          contact={contact as ContactRecord & { _id: string }}
          onCancel={() => setShowRemoveModal(false)}
          onSuccess={() => {
            setShowRemoveModal(false);
            removeContact(contact);
          }}
          selfId={authUser._id}
          show={showRemoveModal}
        />
      )}
    </>
  );
}
