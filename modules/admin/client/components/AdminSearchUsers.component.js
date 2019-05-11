// External dependencies
import classnames from 'classnames';
import React, { Component } from 'react';

// Internal dependencies
import { searchUsers } from '../api/users.api';
import AdminHeader from './AdminHeader.component.js';
import UserState from './UserState.component.js';
import ZendeskInboxSearch from './ZendeskInboxSearch.component.js';

// Maximum limit API will return
const limit = 50;

export default class AdminSearchUsers extends Component {
  constructor(props) {
    super(props);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.state = {
      userResults: []
    };
  }

  componentDidMount() {
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search');

    if (search) {
      this.doSearch(search);
    }
  }

  onSearchChange(event) {
    const { value } = event.target;
    this.doSearch(value);
  }

  async doSearch(search='') {
    if (search.length >= 3) {
      const userResults = await searchUsers(search);
      this.setState(() => ({ userResults }));
    }
  }

  render() {
    const { userResults } = this.state;

    return (
      <>
        <AdminHeader />
        <div className="container">
          <h2 className="font-brand-light">Search users</h2>

          <label>
            Name, username or email<br/>
            <input
              className="form-control input-lg"
              onChange={ this.onSearchChange }
              type="search"
            />
          </label>

          { userResults.length ? (
            <div className="panel panel-default">
              <div className="panel-body">
                <table className="table table-striped table-responsive">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      userResults.map((user) => {
                        const { _id, displayName, email, roles, username } = user;
                        return (
                          <tr
                            className={ classnames({ 'bg-danger': roles.includes('suspended') }) }
                            key={_id}
                          >
                            <td className="admin-search-users__actions">
                              <a href={'/profile/' + username} title="Profile on Trustroots">{ username }</a>
                              <UserState user={ user } />
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ username } />
                              <a
                                className="admin-action admin-hidden-until-hover"
                                href={ `/admin/user?id=${ _id }` }
                              >
                                Show more
                              </a>
                            </td>
                            <td>
                              { displayName }
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ displayName } />
                            </td>
                            <td>
                              { email }
                              <ZendeskInboxSearch className="admin-action admin-hidden-until-hover" q={ email } />
                            </td>
                            <td><small><code style={ { 'userSelect': 'all' } }>{ _id }</code></small></td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                { userResults.length } user(s).
                { userResults.length === limit && <p className="text-warning">There might be more results but { limit } is maximum.</p>}
              </div>
            </div>
          ) : <p><br/><em className="text-muted">Search something...</em></p> }
        </div>
      </>
    );
  };
}

AdminSearchUsers.propTypes = {};
