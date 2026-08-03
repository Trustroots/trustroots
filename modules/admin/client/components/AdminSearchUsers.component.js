// External dependencies
import React, { Component } from 'react';
import PropTypes from 'prop-types';

// Internal dependencies
import { searchUsers, listUsersByRole } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import AdminUserResultsTable from './AdminUserResultsTable.component.js';
import {
  SEARCH_STRING_LIMIT,
  isObviousSpamUser,
  normalizeAdminQuery,
} from './userSearch.helpers.js';

const DEFAULT_MEMBER_LIST_SORT = {
  column: 'username',
  direction: 'ascending',
};

export class AdminSearchUsersContent extends Component {
  constructor(props) {
    super(props);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.onHideObviousSpamUsersChange =
      this.onHideObviousSpamUsersChange.bind(this);
    this.onRoleChange = this.onRoleChange.bind(this);
    this.onPageChange = this.onPageChange.bind(this);
    this.onSortChange = this.onSortChange.bind(this);
    this.doSearch = this.doSearch.bind(this);
    this.doListUsersByRole = this.doListUsersByRole.bind(this);
    this.state = {
      hideObviousSpamUsers: true,
      role: 'admin',
      search: '',
      sort: DEFAULT_MEMBER_LIST_SORT,
      userResults: [],
      userResultsPagination: null,
      userResultsSource: false,
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const search = normalizeAdminQuery(urlParams.get('search'));
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
  }

  onHideObviousSpamUsersChange(event) {
    this.setState({ hideObviousSpamUsers: event.target.checked });
  }

  onPageChange(page) {
    if (this.state.userResultsSource === 'role') {
      return this.doListUsersByRole(null, { page });
    }
    return this.doSearch(null, { page });
  }

  onSortChange(sort) {
    this.setState({ sort }, () => {
      if (this.state.userResultsSource === 'role') {
        this.doListUsersByRole(null, { page: 1, sort });
      } else {
        this.doSearch(null, { page: 1, sort });
      }
    });
  }

  async doListUsersByRole(event, options = {}) {
    if (event) {
      event.preventDefault();
    }
    const { role, sort } = this.state;
    const memberList = await listUsersByRole(role, {
      page: options.page || 1,
      sort: options.sort || sort,
    });
    this.setState({
      sort: memberList.sort,
      userResults: memberList.users,
      userResultsPagination: memberList.pagination,
      userResultsSource: 'role',
    });
  }

  async doSearch(event, options = {}) {
    if (event) {
      event.preventDefault();
    }
    const { sort } = this.state;
    const search = normalizeAdminQuery(this.state.search);
    if (search !== this.state.search) {
      this.setState({ search });
    }
    const url = new URL(document.location);
    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }
    window.history.pushState({ search }, window.document.title, url.toString());
    if (search.length >= SEARCH_STRING_LIMIT) {
      const memberList = await searchUsers(search, {
        page: options.page || 1,
        sort: options.sort || sort,
      });
      this.setState({
        sort: memberList.sort,
        userResults: memberList.users,
        userResultsPagination: memberList.pagination,
        userResultsSource: 'search',
      });
    }
  }

  render() {
    const { showHeading } = this.props;
    const {
      hideObviousSpamUsers,
      sort,
      userResults,
      userResultsPagination,
      userResultsSource,
    } = this.state;
    const normalizedSearch = normalizeAdminQuery(this.state.search);
    const shouldHideObviousSpamUsers =
      hideObviousSpamUsers && userResultsSource === 'search';
    const visibleUserResults = shouldHideObviousSpamUsers
      ? userResults.filter(user => !isObviousSpamUser(user))
      : userResults;
    const hiddenObviousSpamUserCount =
      userResultsSource === 'search'
        ? userResults.length - visibleUserResults.length
        : 0;

    return (
      <>
        {showHeading && <h2>Search members</h2>}

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
                disabled={normalizedSearch.length < SEARCH_STRING_LIMIT}
                type="submit"
              >
                Search
              </button>
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
          onPageChange={this.onPageChange}
          onSortChange={this.onSortChange}
          pagination={userResultsPagination}
          showPublicProfileLink
          showUserState
          showZendeskActions
          sort={sort}
          userResults={visibleUserResults}
        />

        {hiddenObviousSpamUserCount > 0 && (
          <p className="text-muted">
            {hiddenObviousSpamUserCount} likely spam hidden.
          </p>
        )}
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
AdminSearchUsersContent.propTypes = {
  showHeading: PropTypes.bool,
};

AdminSearchUsersContent.defaultProps = {
  showHeading: true,
};
