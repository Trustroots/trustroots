// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { searchUsers, listUsersByRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import UserLink from './UserLink.component.js';
import UserState from './UserState.component.js';
import ZendeskInboxSearch from './ZendeskInboxSearch.component.js';

// Limitations set in the API
const SEARCH_USERS_LIMIT = 50;
const SEARCH_STRING_LIMIT = 3;

export default class AdminSearchUsers extends Component {
  constructor(props) {
    super(props);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.onRoleChange = this.onRoleChange.bind(this);
    this.doSearch = this.doSearch.bind(this);
    this.doListUsersByRole = this.doListUsersByRole.bind(this);
    this.state = {
      role: 'admin',
      search: '',
      userResults: [],
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');
    if (search) {
      this.setState({ search }, this.doSearch);
    }
  }

  onRoleChange(event) {
    const role = event.target.value;
    this.setState({ role });
  }

  onSearchChange(event) {
    const search = event.target.value;
    this.setState({ search });

    // Update URL
    const url = new URL(document.location);
    url.searchParams.set('search', search);
    window.history.pushState({ search }, window.document.title, url.toString());
  }

  async doListUsersByRole(event) {
    if (event) {
      event.preventDefault();
    }
    const { role } = this.state;
    const userResults = await listUsersByRole(role);
    this.setState({ userResults });
  }

  async doSearch(event) {
    if (event) {
      event.preventDefault();
    }
    const { search } = this.state;
    if (search.length >= SEARCH_STRING_LIMIT) {
      const userResults = await searchUsers(search);
      this.setState({ userResults });
    }
  }

  render() {
    const { userResults } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2>Search members</h2>

          <div className="row">
            <div className="col-xs-12 col-md-6">
              <form onSubmit={this.doSearch} className="form-inline">
                <label>
                  Name, username or email
                  <br />
                  <input
                    className="form-control input-md"
                    type="search"
                    value={this.state.search}
                    onChange={this.onSearchChange}
                  />
                </label>
                <button
                  className="btn btn-md btn-default"
                  disabled={this.state.search.length < SEARCH_STRING_LIMIT}
                  type="submit"
                >
                  Search
                </button>
              </form>
            </div>
            <div className="col-xs-12 col-md-6">
              <form
                onSubmit={this.doListUsersByRole}
                className="form-inline pull-right"
              >
                <select
                  name="role"
                  className="form-control input-md"
                  onChange={this.onRoleChange}
                >
                  {[
                    'admin',
                    'moderator',
                    'shadowban',
                    'suspended',
                    'volunteer-alumni',
                    'volunteer',
                  ].map(role => (
                    <option
                      value={role}
                      key={role}
                      selected={role === this.state.role}
                    >
                      {role}
                    </option>
                  ))}
                </select>
                <button className="btn btn-md btn-default" type="submit">
                  List users in role
                </button>
              </form>
            </div>
          </div>

          {userResults.length ? (
            <div className="panel panel-default">
              <div className="panel-body">
                <table className="table table-striped table-responsive">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Signed up</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userResults.map(user => {
                      const {
                        _id,
                        created,
                        displayName,
                        email,
                        emailTemporary,
                        username,
                      } = user;
                      return (
                        <tr key={_id}>
                          <td className="admin-search-users__actions">
                            <UserLink user={user} />
                            <UserState user={user} />
                            <ZendeskInboxSearch
                              className="admin-action admin-hidden-until-hover"
                              q={displayName}
                            />
                            <a
                              className="admin-action admin-hidden-until-hover"
                              href={`/profile/${username}`}
                              title="Public profile on Trustroots"
                            >
                              Public profile
                            </a>
                          </td>
                          <td>
                            <span className="admin-copy-text">{username}</span>
                            <ZendeskInboxSearch
                              className="admin-action admin-hidden-until-hover"
                              q={username}
                            />
                          </td>
                          <td>
                            <span className="admin-copy-text">{email}</span>
                            <ZendeskInboxSearch
                              className="admin-action admin-hidden-until-hover"
                              q={email}
                            />
                            {emailTemporary && emailTemporary !== email && (
                              <>
                                <br />
                                <span className="admin-copy-text">
                                  {emailTemporary}
                                </span>{' '}
                                (temporary email)
                                <ZendeskInboxSearch
                                  className="admin-action admin-hidden-until-hover"
                                  q={emailTemporary}
                                />
                              </>
                            )}
                          </td>
                          <td>
                            {new Date(created).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td>
                            <small>
                              <samp className="admin-copy-text">{_id}</samp>
                            </small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                {userResults.length} user(s).
                {userResults.length === SEARCH_USERS_LIMIT && (
                  <p className="text-warning">
                    There might be more results but {SEARCH_USERS_LIMIT} is
                    maximum.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p>
              <br />
              <em className="text-muted">Search something...</em>
            </p>
          )}
        </div>
      </>
    );
  }
}

AdminSearchUsers.propTypes = {};
