// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { searchUsers, listUsersByRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import AdminUserResultsTable from './AdminUserResultsTable.component.js';
import {
  SEARCH_STRING_LIMIT,
  isObviousSpamUser,
} from './userSearch.helpers.js';

// Limitations set in the API
const SEARCH_USERS_LIMIT = 50;

export class AdminSearchUsersContent extends Component {
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
      this.setState({
        userResults: userResults.filter(user => !isObviousSpamUser(user)),
      });
    }
  }

  render() {
    const { userResults } = this.state;

    return (
      <>
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
                value={this.state.role}
              >
                {[
                  'admin',
                  'shadowban',
                  'suspended',
                  'volunteer-alumni',
                  'volunteer',
                ].map(role => (
                  <option value={role} key={role}>
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

        <AdminUserResultsTable
          showLimitWarning
          showPublicProfileLink
          showUserState
          showZendeskActions
          userResults={userResults}
          usersLimit={SEARCH_USERS_LIMIT}
        />
      </>
    );
  }
}

export default function AdminSearchUsers() {
  return (
    <>
      <AdminHeader />
      <div className="container">
        <AdminSearchUsersContent />
      </div>
    </>
  );
}

AdminSearchUsers.propTypes = {};
AdminSearchUsersContent.propTypes = {};
