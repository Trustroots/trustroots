// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { searchUsers } from '../api/users.api';
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
    this.doSearch = this.doSearch.bind(this);
    this.state = {
      search: '',
      userResults: []
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');
    if (search) {
      this.setState({ search }, this.doSearch);
    }
  }

  onSearchChange(event) {
    const search = event.target.value;
    this.setState({ search });

    // Update URL
    const url = new URL(document.location);
    url.searchParams.set('search', search);
    window.history.pushState(
      { search },
      window.document.title,
      url.toString()
    );
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

          <form onSubmit={ this.doSearch } className="form-inline">
            <label>
              Name, username or email<br/>
              <input
                className="form-control input-lg"
                type="search"
                value={ this.state.search }
                onChange={ this.onSearchChange }
              />
            </label>
            <button
              className="btn btn-lg btn-default"
              disabled={ this.state.search.length < SEARCH_STRING_LIMIT }
              type="submit"
            >
              Search
            </button>
          </form>

          { userResults.length ? (
            <div className="panel panel-default">
              <div className="panel-body">
                <table className="table table-striped table-responsive">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      userResults.map((user) => {
                        const { _id, displayName, email, emailTemporary, username } = user;
                        return (
                          <tr key={_id}>
                            <td className="admin-search-users__actions">
                              <UserLink user={ user } />
                              <UserState user={ user } />
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ displayName } />
                              <a
                                className="admin-action admin-hidden-until-hover"
                                href={ `/profile/${ username }` }
                                title="Public profile on Trustroots"
                              >
                                Public profile
                              </a>
                            </td>
                            <td>
                              <span className="admin-copy-text">{ username }</span>
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ username } />
                            </td>
                            <td>
                              <span className="admin-copy-text">{ email }</span>
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ email } />
                              { (emailTemporary && emailTemporary !== email) && (
                                <>
                                  <br/>
                                  <span className="admin-copy-text">{ emailTemporary }</span> (temporary email)
                                  <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ emailTemporary } />
                                </>
                              ) }
                            </td>
                            <td><small><samp className="admin-copy-text">{ _id }</samp></small></td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                { userResults.length } user(s).
                { userResults.length === SEARCH_USERS_LIMIT && <p className="text-warning">There might be more results but { SEARCH_USERS_LIMIT } is maximum.</p>}
              </div>
            </div>
          ) : <p><br/><em className="text-muted">Search something...</em></p> }
        </div>
      </>
    );
  };
}

AdminSearchUsers.propTypes = {};
