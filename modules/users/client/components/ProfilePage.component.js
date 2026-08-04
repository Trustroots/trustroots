import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import AboutMe from './AboutMe.component';
import AvatarNameMobile from './AvatarNameMobile.component';
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
import { fetch as fetchProfile } from '../api/users.api';
import {
  getMobileProfileRedirect,
  getProfileViewTab,
  getProfileViewTabStateName,
} from '../utils/profile-routes';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';
import { useCurrentPath } from '@/modules/core/client/react-app/useCurrentPath';
import ContactList from '@/modules/contacts/client/components/ContactList.component';
import RemoveContactContainer from '@/modules/contacts/client/components/RemoveContactContainer';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';
import ListExperiences from '@/modules/experiences/client/components/ListExperiences.component';
import Offers from '@/modules/offers/client/components/Offers.component';
import ContactsCommon from '@/modules/contacts/client/components/ContactsCommon.component';
import ReportMember from '@/modules/support/client/components/ReportMember.component';
import Tooltip from '@/modules/core/client/components/Tooltip';

function normalizeContact(contact) {
  if (!contact) {
    return { $resolved: true };
  }

  const normalized = { ...contact, $resolved: true };

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
}) {
  const { t } = useTranslation('users');
  const showContactsCommon =
    profile._id !== authUser._id && (contacts?.length || 0) > 0;
  const showCircles = isSelf || (profile.member && profile.member.length > 0);

  return (
    <div className="row">
      <div className="col-md-6">
        <AboutMe
          isSelf={isSelf}
          profile={profile}
          profileMinimumLength={profileMinimumLength}
        />
      </div>
      <div className="col-md-6">
        <div className="hidden-xs">
          <Offers authUser={authUser} profile={profile} />
        </div>
        {showContactsCommon && <ContactsCommon profileId={profile._id} />}
        {showCircles && (
          <section className="panel panel-default">
            <header className="panel-heading">{t('Circles')}</header>
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

ProfileAboutTab.propTypes = {
  authUser: PropTypes.object.isRequired,
  contacts: PropTypes.array,
  isSelf: PropTypes.bool.isRequired,
  profile: PropTypes.object.isRequired,
  profileMinimumLength: PropTypes.number.isRequired,
};

function ProfileDesktopActions({
  contact,
  contactResolved,
  onRemoveClick,
  profile,
  referencesEnabled,
}) {
  const { t } = useTranslation('users');

  return (
    <ul className="nav nav-pills nav-narrow" role="navigation">
      <li>
        <a href={`/messages/${profile.username}`} className="btn btn-link">
          <i className="fa icon-message-alt" />
          {t('Send a message')}
        </a>
      </li>
      {referencesEnabled && (
        <li>
          <a href={`/profile/${profile.username}/experiences/new`}>
            <i className="icon-plus-squared-alt" />
            {t('Share your experience')}
          </a>
        </li>
      )}
      <li>
        {contactResolved && !contact._id && (
          <a className="btn btn-link" href={`/contact-add/${profile._id}`}>
            <i className="icon-plus-squared-alt" />
            {t('Add contact')}
          </a>
        )}
        {contactResolved && contact._id && (
          <Tooltip
            tooltip={
              contact.confirmed
                ? t('Contacts since {{date, mediumDate}}', {
                    date: new Date(contact.created),
                  })
                : t('Request sent {{date, mediumDate}}', {
                    date: new Date(contact.created),
                  })
            }
            placement="bottom"
          >
            <button
              type="button"
              className="btn btn-link"
              onClick={onRemoveClick}
            >
              <i className="icon-minus-squared-alt" />
              {contact.confirmed
                ? t('Remove contact')
                : t('Delete contact request')}
            </button>
          </Tooltip>
        )}
      </li>
    </ul>
  );
}

ProfileDesktopActions.propTypes = {
  contact: PropTypes.object.isRequired,
  contactResolved: PropTypes.bool.isRequired,
  onRemoveClick: PropTypes.func.isRequired,
  profile: PropTypes.object.isRequired,
  referencesEnabled: PropTypes.bool.isRequired,
};

export default function ProfilePage({ user: authUser }) {
  const { t } = useTranslation('users');
  const { setUser } = useAuth();
  const currentPath = useCurrentPath();
  const { username } = getCurrentRouteParams();
  const { profileMinimumLength = 140, referencesEnabled = false } =
    useSettings();

  const [profile, setProfile] = useState(null);
  const [contact, setContact] = useState({ $resolved: false });
  const [contacts, setContacts] = useState({ $resolved: false, length: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const tab = getProfileViewTab(currentPath, username);
  const activePathName = getProfileViewTabStateName(currentPath, username);
  const isSelf = profile?._id === authUser?._id;

  const removeContact = useCallback(removedContact => {
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

  useEffect(() => {
    const redirectPath = getMobileProfileRedirect(currentPath, username);

    if (redirectPath && redirectPath !== currentPath) {
      window.location.assign(redirectPath);
    }
  }, [currentPath, username]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setContact({ $resolved: false });
      setContacts({ $resolved: false, length: 0 });

      try {
        const loadedProfile = await fetchProfile(username);

        if (!isMounted) {
          return;
        }

        if (!loadedProfile?._id) {
          setProfile({ $resolved: true });
          setIsLoading(false);
          return;
        }

        setProfile({ ...loadedProfile, $resolved: true });

        const viewingOwnProfile = loadedProfile._id === authUser?._id;
        const [loadedContact, loadedContacts] = await Promise.all([
          viewingOwnProfile || !authUser?._id
            ? Promise.resolve(null)
            : contactsApi.getByUserId(loadedProfile._id),
          contactsApi.list(loadedProfile._id),
        ]);

        if (!isMounted) {
          return;
        }

        setContact(normalizeContact(loadedContact));
        setContacts(
          Object.assign([...(loadedContacts || [])], {
            $resolved: true,
            length: loadedContacts?.length || 0,
          }),
        );
      } catch {
        if (isMounted) {
          setProfile({ $resolved: true });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authUser?._id, username]);

  const handleMembershipUpdated = data => {
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
            <AvatarNameMobile profile={profile} />
            <ProfileOverview profile={profile} />
            {!isSelf && (
              <div className="profile-flags">
                <ReportMember
                  className="btn btn-sm btn-default"
                  username={profile.username}
                />
                <br />
                <br />
                <BlockMember
                  className="btn btn-sm btn-default"
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
          <ListExperiences authenticatedUser={authUser} profile={profile} />
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

  return (
    <>
      <TopNavigationSmall
        contact={contact}
        isResolved={contact.$resolved}
        onContactRemoved={removeContact}
        referencesEnabled={referencesEnabled}
        selfId={authUser._id}
        userId={profile?._id}
        username={profile?.username || username}
      />
      <BottomNavigationSmall
        contactCount={contacts.length || 0}
        isSelf={isSelf}
        username={profile?.username || username}
      />

      <section className="container container-spacer profile-view">
        {(authUser.blocked || []).includes(profile?._id) && (
          <BlockedMemberBanner username={profile.username} />
        )}

        {isLoading && (
          <div
            className="row content-wait"
            role="alertdialog"
            aria-busy="true"
            aria-live="assertive"
          >
            <small>{t('Wait a moment…')}</small>
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
            {pendingIncomingContact && (
              <div
                className="row"
                role="alertdialog"
                aria-labelledby="confirmContactDialogLabel"
              >
                <div className="col-xs-12 text-center">
                  <ul className="list-inline">
                    <li id="confirmContactDialogLabel">
                      <strong>{profile.displayName}</strong>{' '}
                      {t('sent you a contact request')}
                    </li>
                    <li>
                      <a
                        className="btn btn-sm btn-primary"
                        href={`/contact-confirm/${contact._id}`}
                      >
                        {t('Confirm Request')}
                      </a>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setShowRemoveModal(true)}
                      >
                        {t('Decline Request')}
                      </button>
                    </li>
                  </ul>
                  <hr />
                </div>
              </div>
            )}

            <div className="row">
              {tab === 'overview' ? (
                <div className="col-sm-12">{tabContent}</div>
              ) : (
                <>
                  <div className="col-sm-3 hidden-xs">
                    <ProfileOverview profile={profile} />
                    {!isSelf && (
                      <div className="profile-flags">
                        <ReportMember
                          className="btn btn-sm btn-default"
                          username={profile.username}
                        />
                        <br />
                        <br />
                        <BlockMember
                          className="btn btn-sm btn-default"
                          isBlocked={(authUser.blocked || []).includes(
                            profile._id,
                          )}
                          username={profile.username}
                        />
                      </div>
                    )}
                  </div>
                  <div className="col-sm-9">
                    <div className="row hidden-xs">
                      <div className="col-xs-12">
                        <h2 className="profile-name">{profile.displayName}</h2>
                        <h4 className="text-muted profile-username">
                          @{profile.username}
                        </h4>
                        {isSelf && (
                          <a
                            href="/profile/edit"
                            className="btn btn-primary pull-right"
                          >
                            {t('Edit your profile')}
                          </a>
                        )}
                        {profile.tagline && (
                          <div className="profile-tagline">
                            {profile.tagline}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isSelf && (
                      <div className="row hidden-xs">
                        <div className="col-xs-12">
                          <ProfileDesktopActions
                            contact={contact}
                            contactResolved={contact.$resolved}
                            onRemoveClick={() => setShowRemoveModal(true)}
                            profile={profile}
                            referencesEnabled={referencesEnabled}
                          />
                        </div>
                      </div>
                    )}

                    <div className="row">
                      <div className="col-xs-12">
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
          contact={contact}
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

ProfilePage.propTypes = {
  user: PropTypes.object.isRequired,
};
