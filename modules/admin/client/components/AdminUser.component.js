// External dependencies
import get from 'lodash/get';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

// Internal dependencies
import { getUser, searchUsers, setUserRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import AdminUserResultsTable from './AdminUserResultsTable.component';
import Json from './Json.component';
import UserEmailConfirmLink from './UserEmailConfirmLink.component';
import UserState from './UserState.component';
import {
  SEARCH_STRING_LIMIT,
  getReferenceUserId,
  isExactUserMatch,
  isMongoObjectId,
  isObviousSpamUser,
  normalizeAdminQuery,
  isSuspendedUser,
} from './userSearch.helpers';

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatLocation(location) {
  if (!Array.isArray(location) || location.length < 2) {
    return null;
  }

  return `${location[1]}, ${location[0]}`;
}

function formatLocationForSearch(location) {
  if (!Array.isArray(location) || location.length < 2) {
    return null;
  }

  return `${location[1]},${location[0]}`;
}

function getUserId(user) {
  return get(user, ['_id']) || user;
}

function getContactOtherMember(contact, currentUserId) {
  const userFrom = get(contact, ['userFrom']);
  const userTo = get(contact, ['userTo']);

  if (getUserId(userFrom) === currentUserId) {
    return userTo;
  }

  if (getUserId(userTo) === currentUserId) {
    return userFrom;
  }

  return get(contact, ['user']) || userTo || userFrom;
}

function newestFirstByCreated(first, second) {
  return new Date(second.created) - new Date(first.created);
}

function InfoTable({ rows }) {
  const visibleRows = rows.filter(([, value]) => value);

  if (!visibleRows.length) {
    return null;
  }

  return (
    <table className="table table-condensed admin-readable-table">
      <tbody>
        {visibleRows.map(([label, value]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

InfoTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
};

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.getUserById = this.getUserById.bind(this);
    this.handleUserRoleChange = this.handleUserRoleChange.bind(this);
    this.onHideObviousSpamUsersChange =
      this.onHideObviousSpamUsersChange.bind(this);
    this.onQueryChange = this.onQueryChange.bind(this);
    this.queryUser = this.queryUser.bind(this);
    this.state = {
      hasSearched: false,
      hideObviousSpamUsers: true,
      isSettingUserRole: false,
      isSearching: false,
      matchingUsers: [],
      query: '',
      user: false,
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const query = urlParams.get('q');

    if (id && isMongoObjectId(id)) {
      this.setState({ query: id }, this.queryUser);
    } else if (query) {
      this.setState({ query }, this.queryUser);
    }
  }

  onQueryChange(event) {
    const query = event.target.value;
    const normalizedQuery = normalizeAdminQuery(query);
    this.setState({ query });

    // Update URL
    const url = new URL(document.location);
    url.searchParams.delete('id');
    url.searchParams.delete('q');
    if (query) {
      if (isMongoObjectId(normalizedQuery)) {
        url.searchParams.set('id', normalizedQuery);
      } else {
        url.searchParams.set('q', query);
      }
    }
    window.history.pushState({ query }, window.document.title, url.toString());
  }

  onHideObviousSpamUsersChange(event) {
    this.setState({ hideObviousSpamUsers: event.target.checked });
  }

  handleUserRoleChange(role) {
    const id = get(this, ['state', 'user', 'profile', '_id']);
    if (id) {
      const username = get(this, ['state', 'user', 'profile', 'username']);
      if (window.confirm(`Set ${username} role to ${role}?`)) {
        this.setState({ isSettingUserRole: true }, async () => {
          await setUserRole(id, role);
          // Get fresh user profile
          this.getUserById(id);
          this.setState({ isSettingUserRole: false });
        });
      }
    }
  }

  queryUser(event) {
    if (event) {
      event.preventDefault();
    }
    const query = normalizeAdminQuery(this.state.query);
    if (query.length < SEARCH_STRING_LIMIT) {
      return;
    }

    if (isMongoObjectId(query)) {
      this.getUserById(query);
      return;
    }

    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        const matchingUsers = await searchUsers(query);
        const exactMatch = matchingUsers.find(user =>
          isExactUserMatch(query, user),
        );

        if (exactMatch) {
          this.getUserById(exactMatch._id);
          return;
        }

        this.setState({
          isSearching: false,
          matchingUsers,
        });
      },
    );
  }

  getUserById(id) {
    this.setState(
      { hasSearched: true, isSearching: true, matchingUsers: [], user: false },
      async () => {
        if (isMongoObjectId(id)) {
          const user = await getUser(id);
          this.setState({ isSearching: false, user });
        }
      },
    );
  }

  hasRole(role) {
    return get(this.state.user, ['profile', 'roles'], []).includes(role);
  }

  render() {
    const {
      hasSearched,
      hideObviousSpamUsers,
      isSearching,
      isSettingUserRole,
      matchingUsers,
      query,
      user,
    } = this.state;
    const isProfile = user && user.profile;
    const isSuspended = isSuspendedUser(get(user, ['profile']));
    const visibleMatchingUsers = hideObviousSpamUsers
      ? matchingUsers.filter(user => !isObviousSpamUser(user))
      : matchingUsers;
    const hiddenObviousSpamUserCount =
      matchingUsers.length - visibleMatchingUsers.length;
    const hasNoMatchingUsers =
      hasSearched && !isSearching && visibleMatchingUsers.length === 0;
    const userId = get(user, ['profile', '_id']);
    const profileLabel = isProfile
      ? user.profile.displayName || user.profile.username || 'Unknown member'
      : '';
    const profileRows = isProfile
      ? [
          ['Display name', user.profile.displayName],
          [
            'Username',
            user.profile.username && (
              <a href={`/profile/${user.profile.username}`}>
                {user.profile.username}
              </a>
            ),
          ],
          [
            'Public profile',
            user.profile.username && (
              <a href={`/profile/${user.profile.username}`}>
                /profile/{user.profile.username}
              </a>
            ),
          ],
          ['Email', user.profile.email],
          ['Temporary email', user.profile.emailTemporary],
          [
            'Roles',
            user.profile.roles && user.profile.roles.length
              ? user.profile.roles.join(', ')
              : null,
          ],
          ['Profile visible', user.profile.public ? 'Yes' : 'No'],
          ['Signed up', formatDate(user.profile.created)],
          ['Last seen', formatDate(user.profile.seen)],
          [
            'Location',
            user.profile.location &&
              [user.profile.location.city, user.profile.location.country]
                .filter(Boolean)
                .join(', '),
          ],
        ].filter(([, value]) => value)
      : [];
    const threadReferences =
      user && user.threadReferences ? user.threadReferences : [];
    const threadVoteGroups = isProfile
      ? [
          {
            id: 'thread-votes-received-positive',
            label: 'Positive votes received',
            reference: 'yes',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userTo') === userId &&
                referenceThread.reference === 'yes',
            ),
          },
          {
            id: 'thread-votes-received-negative',
            label: 'Negative votes received',
            reference: 'no',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userTo') === userId &&
                referenceThread.reference === 'no',
            ),
          },
          {
            id: 'thread-votes-gave-positive',
            label: 'Positive votes gave',
            reference: 'yes',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userFrom') === userId &&
                referenceThread.reference === 'yes',
            ),
          },
          {
            id: 'thread-votes-gave-negative',
            label: 'Negative votes gave',
            reference: 'no',
            votes: threadReferences.filter(
              referenceThread =>
                getReferenceUserId(referenceThread, 'userFrom') === userId &&
                referenceThread.reference === 'no',
            ),
          },
        ]
      : [];
    const hasThreadVotes = threadVoteGroups.some(({ votes }) => votes.length);

    return (
      <>
        <AdminHeader />
        <div className="container admin-user-page">
          <div className="admin-user-page__search">
            <h2>Member report card</h2>

            <form
              onSubmit={this.queryUser}
              className="form-inline admin-user-search-form"
            >
              <input
                aria-label="Member username, email or ID"
                className="form-control input-lg"
                onChange={this.onQueryChange}
                placeholder="Member username, email or ID"
                size={32}
                type="search"
                value={query}
              />
              <div className="checkbox">
                <label>
                  <input
                    checked={hideObviousSpamUsers}
                    onChange={this.onHideObviousSpamUsersChange}
                    type="checkbox"
                  />{' '}
                  Hide obvious spam
                </label>
              </div>
            </form>

            {isSearching && (
              <p className="admin-user-loading text-muted">Loading member...</p>
            )}
          </div>

          {!isProfile && (
            <AdminUserResultsTable userResults={visibleMatchingUsers} />
          )}

          {!isProfile && hiddenObviousSpamUserCount > 0 && (
            <p className="text-muted">
              {hiddenObviousSpamUserCount} likely spam hidden.
            </p>
          )}

          {!isProfile && hasNoMatchingUsers && (
            <p>
              <br />
              <em className="text-muted">No matching members found.</em>
            </p>
          )}

          {isProfile && (
            <>
              <div className="admin-user-report-header">
                <h3>
                  <strong>{profileLabel}</strong> report card
                </h3>

                <div className="admin-user-actions">
                  {user.profile.username && !isSuspended && (
                    <a
                      className="btn btn-default"
                      href={`/profile/${user.profile.username}`}
                    >
                      Public profile
                    </a>
                  )}
                  {[
                    {
                      role: 'suspended',
                      color: 'danger',
                      label: 'Suspend',
                    },
                    ...(isSuspended
                      ? []
                      : [
                          {
                            role: 'shadowban',
                            color: 'danger',
                            label: 'Shadow ban',
                          },
                          {
                            role: 'volunteer',
                            color: 'success',
                            label: 'Make volunteer',
                          },
                          {
                            role: 'volunteer-alumni',
                            color: 'success',
                            label: 'Make volunteer alumni',
                          },
                        ]),
                  ].map(({ role, color, label }) => (
                    <button
                      key={role}
                      className={`btn btn-${color}`}
                      disabled={
                        user.profile.roles.includes(role) || isSettingUserRole
                      }
                      onClick={() => this.handleUserRoleChange(role)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <h4 id="stats">
                <a href="#stats">Stats</a>
              </h4>
              <div className="panel panel-default admin-user">
                <div className="panel-body">
                  <UserState user={user.profile} />
                  <ul className="list-inline">
                    <li>
                      <strong>Messages</strong>
                    </li>
                    <li>{user.messageFromCount || 0} sent</li>
                    <li>{user.messageToCount || 0} received</li>
                    <li>
                      <a href={`/admin/threads?userId=${user.profile._id}`}>
                        {user.threadCount || 0} threads total
                      </a>
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes received</strong>
                    </li>
                    <li>
                      <a
                        className="text-success"
                        href="#thread-votes-received-positive"
                      >
                        {user.threadReferencesReceivedYes} positive
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-danger"
                        href="#thread-votes-received-negative"
                      >
                        {user.threadReferencesReceivedNo} negative
                      </a>
                    </li>
                  </ul>
                  <ul className="list-inline">
                    <li>
                      <strong>Thread votes gave</strong>
                    </li>
                    <li>
                      <a
                        className="text-success"
                        href="#thread-votes-gave-positive"
                      >
                        {user.threadReferencesSentYes} positive
                      </a>
                    </li>
                    <li>
                      <a
                        className="text-danger"
                        href="#thread-votes-gave-negative"
                      >
                        {user.threadReferencesSentNo} negative
                      </a>
                    </li>
                  </ul>
                  <p>
                    <strong>{user.contacts.length} contact(s)</strong>
                  </p>
                  <p>
                    <strong>
                      {user.offers.length} hosting or meet offer(s)
                    </strong>
                  </p>
                  <UserEmailConfirmLink user={user.profile} />
                </div>
              </div>

              {hasThreadVotes && (
                <>
                  <h4 id="thread-votes">
                    <a href="#thread-votes">Thread votes</a>
                  </h4>
                  <div className="panel panel-default">
                    <div className="panel-body">
                      {threadVoteGroups.map(
                        ({ id, label, votes }) =>
                          votes.length > 0 && (
                            <section id={id} key={id}>
                              <h5>{label}</h5>
                              <ul className="list-unstyled">
                                {votes.map(referenceThread => (
                                  <AdminReferenceVoteItem
                                    key={referenceThread._id}
                                    referenceThread={referenceThread}
                                    showBadge
                                    showMessagesLink
                                  />
                                ))}
                              </ul>
                            </section>
                          ),
                      )}
                    </div>
                  </div>
                </>
              )}

              <AdminNotes id={userId} />

              <h4 id="profile">
                <a href="#profile">Profile</a>
                <details className="admin-section-raw-data">
                  <summary>raw data</summary>
                  <Json content={user.profile} />
                </details>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  <InfoTable rows={profileRows} />
                </div>
              </div>
            </>
          )}

          {user && (
            <>
              <h4 id="offers">
                <a href="#offers">Hosting & meeting offers</a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.offers.length ? (
                    user.offers.map(offer => {
                      const formattedLocation = formatLocation(offer.location);
                      const searchLocation = formatLocationForSearch(
                        offer.location,
                      );

                      return (
                        <div className="admin-readable-item" key={offer._id}>
                          <InfoTable
                            rows={[
                              ['Type', offer.type],
                              ['Status', offer.status],
                              ['Description', offer.description],
                              ['Location', formattedLocation],
                              ['Created', formatDate(offer.created)],
                              ['Updated', formatDate(offer.updated)],
                            ]}
                          />
                          <p>
                            <a
                              href={`/search?offer=${offer._id}`}
                              className="btn btn-sm btn-default"
                            >
                              Show offer on map
                            </a>
                            {formattedLocation && (
                              <a
                                href={`/search?location=${searchLocation}`}
                                className="btn btn-sm btn-default"
                              >
                                Show location on map
                              </a>
                            )}
                          </p>
                          <details>
                            <summary>Raw offer data</summary>
                            <Json content={offer} />
                          </details>
                        </div>
                      );
                    })
                  ) : (
                    <p>
                      <em>{"Member doesn't have any saved offers."}</em>
                    </p>
                  )}
                </div>
              </div>

              <h4 id="contacts">
                <a href="#contacts">Contacts</a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.contacts.length ? (
                    <table className="table table-condensed table-striped">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...user.contacts]
                          .sort(newestFirstByCreated)
                          .map(contact => {
                            const contactMember = getContactOtherMember(
                              contact,
                              userId,
                            );
                            const contactName =
                              get(contactMember, ['username']) ||
                              get(contactMember, ['displayName']) ||
                              'Unknown member';
                            const contactMemberId = get(contactMember, ['_id']);

                            return (
                              <tr key={contact._id}>
                                <td>
                                  {contactMemberId ? (
                                    <a
                                      href={`/admin/user?id=${contactMemberId}`}
                                    >
                                      {contactName}
                                    </a>
                                  ) : (
                                    contactName
                                  )}
                                </td>
                                <td>{formatDate(contact.created)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  ) : (
                    <p>
                      <em>{"Member doesn't have any contacts."}</em>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </>
    );
  }
}

AdminUser.propTypes = {};
