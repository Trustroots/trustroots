// External dependencies
import get from 'lodash/get';
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
} from './userSearch.helpers';

export default class AdminUser extends Component {
  constructor(props) {
    super(props);
    this.getUserById = this.getUserById.bind(this);
    this.handleUserRoleChange = this.handleUserRoleChange.bind(this);
    this.onQueryChange = this.onQueryChange.bind(this);
    this.queryUser = this.queryUser.bind(this);
    this.state = {
      hasSearched: false,
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
          matchingUsers: matchingUsers.filter(user => !isObviousSpamUser(user)),
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
      isSearching,
      isSettingUserRole,
      matchingUsers,
      query,
      user,
    } = this.state;
    const isProfile = user && user.profile;
    const hasNoMatchingUsers =
      hasSearched && !isSearching && matchingUsers.length === 0;
    const userId = get(user, ['profile', '_id']);
    const profileLabel = isProfile
      ? user.profile.username || user.profile.displayName || 'Unknown member'
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
          ['Email', user.profile.email],
          ['Temporary email', user.profile.emailTemporary],
          [
            'Roles',
            user.profile.roles && user.profile.roles.length
              ? user.profile.roles.join(', ')
              : null,
          ],
          ['Profile visible', user.profile.public ? 'Yes' : 'No'],
          [
            'Signed up',
            user.profile.created &&
              new Date(user.profile.created).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
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
        <div className="container">
          <h2>Member report card</h2>

          <form onSubmit={this.queryUser} className="form-inline">
            <label>
              Member username, email or ID
              <br />
              <input
                className="form-control input-lg"
                onChange={this.onQueryChange}
                size={32}
                type="search"
                value={query}
              />
            </label>
            <button
              className="btn btn-lg btn-default"
              disabled={query.trim().length < SEARCH_STRING_LIMIT}
              type="submit"
            >
              Show
            </button>
          </form>

          {!isProfile && <AdminUserResultsTable userResults={matchingUsers} />}

          {!isProfile && hasNoMatchingUsers && (
            <p>
              <br />
              <em className="text-muted">No matching members found.</em>
            </p>
          )}

          {isProfile && (
            <>
              <h3 className="pull-left">
                <strong>{profileLabel}</strong> report card
              </h3>

              <div className="btn-group">
                {user.profile.username && (
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

              <h4 id="stats">
                Stats
                <a href="#stats" className="btn btn-link">
                  #
                </a>
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
                    Thread votes
                    <a href="#thread-votes" className="btn btn-link">
                      #
                    </a>
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
                Profile
                <a href="#profile" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  <table className="table table-condensed">
                    <tbody>
                      {profileRows.map(([label, value]) => (
                        <tr key={label}>
                          <th>{label}</th>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <details>
                    <summary>Raw profile data</summary>
                    <Json content={user.profile} />
                  </details>
                </div>
              </div>
            </>
          )}

          {user && (
            <>
              <h4 id="offers">
                Hosting & meeting offers
                <a href="#offers" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.offers.length ? (
                    user.offers.map(offer => (
                      <div key={offer._id}>
                        <Json content={offer} />
                        <a
                          href={`/search?offer=${offer._id}`}
                          className="btn btn-sm btn-default"
                        >
                          Show offer on map
                        </a>
                        <a
                          href={`/search?location=${offer.location[1]},${offer.location[0]}`}
                          className="btn btn-sm btn-default"
                        >
                          Show location on map
                        </a>
                        <hr className="hr-gray" />
                      </div>
                    ))
                  ) : (
                    <p>
                      <em>{"Member doesn't have any saved offers."}</em>
                    </p>
                  )}
                </div>
              </div>

              <h4 id="contacts">
                Contacts
                <a href="#contacts" className="btn btn-link">
                  #
                </a>
              </h4>
              <div className="panel panel-default">
                <div className="panel-body">
                  {user.contacts.length ? (
                    user.contacts.map(contact => (
                      <Json content={contact} key={contact._id} />
                    ))
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
